import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import type {
    LLMProvider,
    LLMMessage,
    LLMResponse,
    LLMTool,
    ChatOptions,
    ToolCall,
} from '../types';

// ============================================================
// Constants
// ============================================================

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.7;

// ============================================================
// Mappers — internal format ↔ Anthropic format
// ============================================================

function mapMessagesToAnthropic(
    messages: LLMMessage[],
): Anthropic.MessageParam[] {
    return messages
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
        }));
}

function mapToolsToAnthropic(tools: LLMTool[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
            type: 'object' as const,
            properties: Object.fromEntries(
                Object.entries(tool.parameters.properties).map(([key, param]) => [
                    key,
                    {
                        type: param.type,
                        description: param.description,
                        ...(param.enum !== undefined && { enum: param.enum }),
                    },
                ]),
            ),
            required: tool.parameters.required,
        },
    }));
}

function extractSystemPrompt(messages: LLMMessage[]): string | undefined {
    const systemMsg = messages.find((msg) => msg.role === 'system');
    return systemMsg?.content;
}

function mapAnthropicResponseToLLMResponse(
    response: Anthropic.Message,
): LLMResponse {
    // Anthropic mengembalikan array content blocks
    // Setiap block bisa bertype 'text' atau 'tool_use'
    const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
    );

    const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    const content =
        textBlocks.length > 0 ? textBlocks.map((b) => b.text).join('') : null;

    const toolCalls: ToolCall[] = toolUseBlocks.map((block) => ({
        id: block.id,
        name: block.name,
        args: block.input as Record<string, unknown>,
    }));

    return {
        content,
        toolCalls,
        usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        },
    };
}

// ============================================================
// Adapter
// ============================================================

export class ClaudeAdapter implements LLMProvider {
    private readonly client: Anthropic;
    private readonly modelName: string;

    constructor() {
        if (env.ANTHROPIC_API_KEY === undefined) {
            throw new Error(
                'ANTHROPIC_API_KEY tidak ditemukan. Set env variable sebelum menggunakan ClaudeAdapter.',
            );
        }

        this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        this.modelName = env.LLM_MODEL ?? DEFAULT_MODEL;
    }

    async chat(
        messages: LLMMessage[],
        options: ChatOptions = {},
    ): Promise<LLMResponse> {
        try {
            const systemPrompt =
                options.systemPrompt ?? extractSystemPrompt(messages);
            const anthropicMessages = mapMessagesToAnthropic(messages);

            const response = await this.client.messages.create({
                model: this.modelName,
                max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
                temperature: options.temperature ?? DEFAULT_TEMPERATURE,
                ...(systemPrompt !== undefined && { system: systemPrompt }),
                messages: anthropicMessages,
                ...(options.tools !== undefined &&
                    options.tools.length > 0 && {
                        tools: mapToolsToAnthropic(options.tools),
                        tool_choice: { type: 'auto' },
                    }),
            });

            return mapAnthropicResponseToLLMResponse(response);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`ClaudeAdapter.chat gagal: ${message}`);
        }
    }

    async chatStream(
        messages: LLMMessage[],
        options: ChatOptions = {},
        onChunk?: (chunk: string) => void,
    ): Promise<LLMResponse> {
        try {
            const systemPrompt =
                options.systemPrompt ?? extractSystemPrompt(messages);
            const anthropicMessages = mapMessagesToAnthropic(messages);

            // Anthropic streaming pakai helper stream() yang
            // handle accumulation secara internal
            const stream = await this.client.messages.stream({
                model: this.modelName,
                max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
                temperature: options.temperature ?? DEFAULT_TEMPERATURE,
                ...(systemPrompt !== undefined && { system: systemPrompt }),
                messages: anthropicMessages,
                ...(options.tools !== undefined &&
                    options.tools.length > 0 && {
                        tools: mapToolsToAnthropic(options.tools),
                        tool_choice: { type: 'auto' },
                    }),
            });

            // Stream text chunks ke caller
            for await (const chunk of stream) {
                if (
                    chunk.type === 'content_block_delta' &&
                    chunk.delta.type === 'text_delta'
                ) {
                    onChunk?.(chunk.delta.text);
                }
            }

            // Ambil final message setelah stream selesai
            const finalMessage = await stream.finalMessage();
            return mapAnthropicResponseToLLMResponse(finalMessage);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`ClaudeAdapter.chatStream gagal: ${message}`);
        }
    }
}