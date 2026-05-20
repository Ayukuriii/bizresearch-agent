import { getLLMProvider } from '../llm/factory';
import { LLMMessage, LLMTool, AgentStep } from '../llm/types';
import { AppError } from '../utils/errors';
import { getHistory, appendHistory } from './memory';
import { BUSINESS_RESEARCH_SYSTEM_PROMPT, getToolErrorPrompt } from './prompts';
import { webSearchTool, executeWebSearch } from '../tools/webSearch';
import { scrapeTool, executeScrape } from '../tools/scraper';
import { summarizerTool, executeSummarize } from '../tools/summarizer';
import logger from '../lib/logger';
import pino from "pino";

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

    // Child logger — all logs from this run carry sessionId automatically
    const log = logger.child({ sessionId });

    log.info({ userMessage }, 'Agent run started');

    // 1. Load history from Redis
    const history = await getHistory(sessionId);

    // 2. Append user message to history
    const userMsg: LLMMessage = { role: 'user', content: userMessage };
    const messages: LLMMessage[] = [...history, userMsg];

    const provider = getLLMProvider();
    let iteration = 0;

    // 3. Agent loop
    while (iteration < MAX_ITERATIONS) {
        iteration++;

        log.debug({ iteration, maxIterations: MAX_ITERATIONS }, 'Agent iteration started');

        yield {
            type: 'thinking',
            message: `Iteration ${iteration} of ${MAX_ITERATIONS}`,
            iteration,
        };

        // Call LLM
        let response;
        try {
            response = await provider.chat(messages, {
                tools: TOOL_DEFINITIONS,
                systemPrompt: BUSINESS_RESEARCH_SYSTEM_PROMPT,
            });
        } catch (err) {
            log.error({ err, iteration }, 'LLM call failed');
            yield {
                type: 'error',
                message: `LLM call failed on iteration ${iteration}: ${String(err)}`,
                iteration,
            };
            break;
        }

        // Append assistant response to messages
        if (response.content !== null) {
            messages.push({ role: 'assistant', content: response.content });
        }

        // 4. No tool calls → final answer
        if (response.toolCalls.length === 0) {
            const finalAnswer = response.content ?? 'No response generated.';

            log.info({ iteration }, 'Agent completed — final answer produced');

            yield {
                type: 'final_answer',
                message: finalAnswer,
                iteration,
            };

            break;
        }

        // 5. Tool calls present → execute each one
        for (const toolCall of response.toolCalls) {
            log.debug(
                { iteration, toolName: toolCall.name, args: toolCall.args },
                'Tool call dispatched',
            );

            yield {
                type: 'tool_call',
                toolName: toolCall.name,
                args: toolCall.args,
                iteration,
            };

            const toolResult = await executeTool(toolCall.name, toolCall.args, log);

            log.debug(
                { iteration, toolName: toolCall.name, resultLength: toolResult.length },
                'Tool call completed',
            );

            yield {
                type: 'tool_result',
                toolName: toolCall.name,
                result: toolResult,
                iteration,
            };

            // Append tool result to messages as role user
            messages.push({
                role: 'user',
                content: `[${TOOL_RESULT_PREFIX}: ${toolCall.name}]\n${toolResult}`,
            });
        }
    }

    // 6. Persist updated history to Redis (new messages only)
    await appendHistory(sessionId, [
        userMsg,
        ...messages.slice(history.length + 1),
    ]);

    log.info({ iteration }, 'Agent run finished');
}

// ─── Tool Executor ────────────────────────────────────────────────────────────

async function executeTool(
    name: string,
    args: unknown,
    log: pino.Logger,
): Promise<string> {
    const executor = TOOL_EXECUTORS[name];

    if (!executor) {
        log.warn({ toolName: name }, 'Unknown tool requested');
        return `Unknown tool "${name}". Available tools: ${Object.keys(TOOL_EXECUTORS).join(', ')}.`;
    }

    try {
        return await executor(args);
    } catch (err) {
        // Tool failure must not crash the agent loop — return error as string
        const message = err instanceof AppError ? err.message : String(err);
        log.error({ err, toolName: name }, 'Tool execution failed');
        return getToolErrorPrompt(name, message);
    }
}