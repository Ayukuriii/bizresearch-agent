import { getLLMProvider } from '../llm/factory';
import { LLMMessage, LLMTool, AgentStep } from '../llm/types';
import { AppError } from '../utils/errors';
import { getHistory, appendHistory } from './memory';
import { BUSINESS_RESEARCH_SYSTEM_PROMPT, getToolErrorPrompt } from './prompts';
import { webSearchTool, executeWebSearch } from '../tools/webSearch';
import { scrapeTool, executeScrape } from '../tools/scraper';
import { summarizerTool, executeSummarize } from '../tools/summarizer';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 10;
const TOOL_RESULT_PREFIX = 'Tool Result';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunAgentOptions {
    sessionId: string;
    userMessage: string;
}

// ─── Tool Registry ────────────────────────────────────────────────────────────

const TOOL_DEFINITIONS: LLMTool[] = [
    webSearchTool,
    scrapeTool,
    summarizerTool,
];

const TOOL_EXECUTORS: Record<string, (args: unknown) => Promise<string>> = {
    [webSearchTool.name]: executeWebSearch,
    [scrapeTool.name]: executeScrape,
    [summarizerTool.name]: executeSummarize,
};

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function* runAgent(
    options: RunAgentOptions,
): AsyncGenerator<AgentStep> {
    const { sessionId, userMessage } = options;

    // 1. Load history dari Redis
    const history = await getHistory(sessionId);

    // 2. Append user message ke history
    const userMsg: LLMMessage = { role: 'user', content: userMessage };
    const messages: LLMMessage[] = [...history, userMsg];

    const provider = getLLMProvider();
    let iteration = 0;

    // 3. Agent loop
    while (iteration < MAX_ITERATIONS) {
        iteration++;

        yield {
            type: 'thinking',
            message: `Iteration ${iteration} of ${MAX_ITERATIONS}`,
            iteration,
        };

        // Panggil LLM
        let response;
        try {
            response = await provider.chat(messages, {
                tools: TOOL_DEFINITIONS,
                systemPrompt: BUSINESS_RESEARCH_SYSTEM_PROMPT,
            });
        } catch (err) {
            yield {
                type: 'error',
                message: `LLM call failed on iteration ${iteration}: ${String(err)}`,
                iteration,
            };
            break;
        }

        // Append assistant response ke messages
        if (response.content !== null) {
            messages.push({ role: 'assistant', content: response.content });
        }

        // 4. Tidak ada tool call → final answer
        if (response.toolCalls.length === 0) {
            const finalAnswer = response.content ?? 'No response generated.';

            yield {
                type: 'final_answer',
                message: finalAnswer,
                iteration,
            };

            break;
        }

        // 5. Ada tool call → eksekusi satu per satu
        for (const toolCall of response.toolCalls) {
            yield {
                type: 'tool_call',
                toolName: toolCall.name,
                args: toolCall.args,
                iteration,
            };

            const toolResult = await executeTool(toolCall.name, toolCall.args);

            yield {
                type: 'tool_result',
                toolName: toolCall.name,
                result: toolResult,
                iteration,
            };

            // Append tool result ke messages sebagai role user
            messages.push({
                role: 'user',
                content: `[${TOOL_RESULT_PREFIX}: ${toolCall.name}]\n${toolResult}`,
            });
        }
    }

    // 6. Simpan updated history ke Redis (tanpa system messages)
    await appendHistory(sessionId, [
        userMsg,
        ...messages.slice(history.length + 1), // hanya messages baru
    ]);
}

// ─── Tool Executor ────────────────────────────────────────────────────────────

async function executeTool(name: string, args: unknown): Promise<string> {
    const executor = TOOL_EXECUTORS[name];

    if (!executor) {
        return `Unknown tool "${name}". Available tools: ${Object.keys(TOOL_EXECUTORS).join(', ')}.`;
    }

    try {
        return await executor(args);
    } catch (err) {
        // Tool gagal tidak boleh crash agent loop
        const message = err instanceof AppError ? err.message : String(err);
        return getToolErrorPrompt(name, message);
    }
}
