import { getLLMProvider } from '../llm/factory';
import { LLMTool } from '../llm/types';
import { AppError } from '../utils/errors';
import { ERROR_CODE, HTTP_STATUS, SUMMARIZER } from './constants';
import { getSummarizationPrompt } from '../agent/prompts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummarizeArgs {
    text: string;
    focus?: string;
}

// ─── Tool Definition ──────────────────────────────────────────────────────────

export const summarizerTool: LLMTool = {
    name: SUMMARIZER.TOOL_NAME,
    description:
        'Summarize a long piece of text into a concise, structured summary. Use this ' +
        'after scraping or retrieving large amounts of text to extract only the relevant ' +
        'information. Optionally provide a focus to guide what aspects to emphasize.',
    parameters: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'The text content to summarize.',
            },
            focus: {
                type: 'string',
                description:
                    'Optional. What aspect to focus on when summarizing, e.g. "financial performance" ' +
                    'or "product offerings". If omitted, produces a general summary.',
            },
        },
        required: ['text'],
    },
};

// ─── Execution ────────────────────────────────────────────────────────────────

export async function executeSummarize(args: unknown): Promise<string> {
    const parsed = parseArgs(args);

    const provider = getLLMProvider();
    const prompt = getSummarizationPrompt(parsed.text, parsed.focus);

    let response;

    try {
        response = await provider.chat([{ role: 'user', content: prompt }]);
    } catch (err) {
        throw new AppError(
            `Summarizer failed to get a response from LLM: ${String(err)}`,
            ERROR_CODE.NETWORK,
            HTTP_STATUS.BAD_GATEWAY,
        );
    }

    if (response.content === null) {
        throw new AppError(
            'Summarizer received an empty response from LLM — model may have only returned tool calls.',
            ERROR_CODE.NETWORK,
            HTTP_STATUS.BAD_GATEWAY,
        );
    }

    return response.content;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(args: unknown): SummarizeArgs {
    if (typeof args !== 'object' || args === null) {
        throw new AppError(
            `${SUMMARIZER.TOOL_NAME} requires an object argument with at least a "text" field.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const obj = args as Record<string, unknown>;

    if (typeof obj['text'] !== 'string' || obj['text'].trim() === '') {
        throw new AppError(
            `${SUMMARIZER.TOOL_NAME} "text" must be a non-empty string.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    if (obj['text'].length > SUMMARIZER.MAX_INPUT_LENGTH) {
        throw new AppError(
            `${SUMMARIZER.TOOL_NAME} "text" exceeds maximum length of ${SUMMARIZER.MAX_INPUT_LENGTH} characters. ` +
            `Consider truncating the input first.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    if (obj['focus'] !== undefined && typeof obj['focus'] !== 'string') {
        throw new AppError(
            `${SUMMARIZER.TOOL_NAME} "focus" must be a string if provided.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    return {
        text: obj['text'].trim(),
        focus: typeof obj['focus'] === 'string' ? obj['focus'].trim() : undefined,
    };
}