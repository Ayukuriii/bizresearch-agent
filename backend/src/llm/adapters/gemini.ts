import {
    GoogleGenerativeAI,
    SchemaType,
    type Content,
    type Tool,
    type FunctionCallingMode,
} from '@google/generative-ai';
import {env} from '../../config/env';
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

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.7;

// ============================================================
// Mappers — internal format ↔ Gemini format
// ============================================================

function mapMessagesToGemini(messages: LLMMessage[]): Content[] {
    return messages
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));
}

function mapToolsToGemini(tools: LLMTool[]): Tool[] {
    const functionDeclarations = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
            type: SchemaType.OBJECT,
            properties: Object.fromEntries(
                Object.entries(tool.parameters.properties).map(([key, param]) => [
                    key,
                    {
                        type: param.type.toUpperCase() as SchemaType,
                        description: param.description,
                        ...(param.enum !== undefined && { enum: param.enum }),
                    },
                ])
            ),
            required: tool.parameters.required,
        },
    }));

    // Cast diperlukan karena Gemini SDK Schema type
    // membutuhkan field 'format' yang tidak relevan
    // untuk use case tool calling kita
    return [{ functionDeclarations }] as unknown as Tool[];
}

function extractSystemPrompt(messages: LLMMessage[]): string | undefined {
    const systemMsg = messages.find((msg) => msg.role === 'system');
    return systemMsg?.content;
}

function mapGeminiResponseToLLMResponse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: any
): LLMResponse {
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const textParts = parts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => typeof p.text === 'string')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => p.text as string);

    const content = textParts.length > 0 ? textParts.join('') : null;

    const toolCalls: ToolCall[] = parts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => p.functionCall !== undefined)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any, index: number) => ({
            id: `gemini-tool-${Date.now()}-${index}`,
            name: p.functionCall.name as string,
            args: (p.functionCall.args ?? {}) as Record<string, unknown>,
        }));

    return {
        content,
        toolCalls,
        usage: {
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        },
    };
}

// ============================================================
// Adapter
// ============================================================

export class GeminiAdapter implements LLMProvider {
    private readonly client: GoogleGenerativeAI;
    private readonly modelName: string;

    constructor() {
        if (env.GOOGLE_AI_API_KEY === undefined) {
            throw new Error(
                'GOOGLE_AI_API_KEY tidak ditemukan. Set env variable sebelum menggunakan GeminiAdapter.'
            );
        }

        this.client = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
        this.modelName = env.LLM_MODEL ?? DEFAULT_MODEL;

        console.log(`[GeminiAdapter] Using model: ${this.modelName}`);
    }

    async chat(messages: LLMMessage[], options: ChatOptions = {}): Promise<LLMResponse> {
        try {
            const systemPrompt = extractSystemPrompt(messages);
            const history = mapMessagesToGemini(messages);

            // Pisahkan pesan terakhir dari history — Gemini butuh ini
            // sebagai "current user message" yang terpisah
            const lastMessage = history.pop();

            if (lastMessage === undefined) {
                throw new Error('Messages tidak boleh kosong');
            }

            const model = this.client.getGenerativeModel({
                model: this.modelName,
                ...(systemPrompt !== undefined && {
                    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
                }),
                generationConfig: {
                    maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
                    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
                },
                ...(options.tools !== undefined &&
                    options.tools.length > 0 && {
                        tools: mapToolsToGemini(options.tools),
                        toolConfig: {
                            functionCallingConfig: {
                                mode: 'AUTO' as FunctionCallingMode,
                            },
                        },
                    }),
            });

            const chat = model.startChat({ history });
            const result = await chat.sendMessage(lastMessage.parts);
            const response = await result.response;

            return mapGeminiResponseToLLMResponse(response);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`GeminiAdapter.chat gagal: ${message}`);
        }
    }

    async chatStream(
        messages: LLMMessage[],
        options: ChatOptions = {},
        onChunk?: (chunk: string) => void
    ): Promise<LLMResponse> {
        try {
            const systemPrompt = extractSystemPrompt(messages);
            const history = mapMessagesToGemini(messages);
            const lastMessage = history.pop();

            if (lastMessage === undefined) {
                throw new Error('Messages tidak boleh kosong');
            }

            const model = this.client.getGenerativeModel({
                model: this.modelName,
                ...(systemPrompt !== undefined && {
                    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
                }),
                generationConfig: {
                    maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
                    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
                },
                ...(options.tools !== undefined &&
                    options.tools.length > 0 && {
                        tools: mapToolsToGemini(options.tools),
                        toolConfig: {
                            functionCallingConfig: {
                                mode: 'AUTO' as FunctionCallingMode,
                            },
                        },
                    }),
            });

            const chat = model.startChat({ history });
            const result = await chat.sendMessageStream(lastMessage.parts);

            let fullText = '';

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    fullText += chunkText;
                    onChunk?.(chunkText);
                }
            }

            const finalResponse = await result.response;
            const mapped = mapGeminiResponseToLLMResponse(finalResponse);

            // Override content dengan accumulated stream text
            // karena tool calls tidak di-stream, kita ambil dari finalResponse
            return {
                ...mapped,
                content: mapped.toolCalls.length > 0 ? mapped.content : fullText || null,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`GeminiAdapter.chatStream gagal: ${message}`);
        }
    }
}