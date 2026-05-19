import { env } from '../config/env';
import { LLMTool } from '../llm/types';
import { AppError } from '../utils/errors';
import {ERROR_CODE, HTTP_STATUS, WEB_SEARCH} from "./constants";


// ─── Types ────────────────────────────────────────────────────────────────────

interface TavilySearchArgs {
    query: string;
    max_results?: number;
}

interface TavilyResult {
    title: string;
    url: string;
    content: string;
    score: number;
}

interface TavilyResponse {
    results: TavilyResult[];
    answer?: string;
}

// ─── Tool Definition (sent to LLM) ────────────────────────────────────────

export const webSearchTool: LLMTool = {
    name: WEB_SEARCH.TOOL_NAME,
    description:
        'Search the web for current information about a topic. Use this when you need ' +
        'up-to-date data, market information, company details, or any facts that require ' +
        'real-time retrieval. Returns a list of relevant results with titles, URLs, and snippets.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query. Be specific and concise for best results.',
            },
            max_results: {
                type: 'number',
                description: `Number of results to return. Defaults to ${WEB_SEARCH.DEFAULT_MAX_RESULTS}, max ${WEB_SEARCH.MAX_RESULTS_LIMIT}.`,
            },
        },
        required: ['query'],
    },
};

// ─── Execution ────────────────────────────────────────────────────────────────

export async function executeWebSearch(args: unknown): Promise<string> {
    const parsed = parseArgs(args);

    const maxResults = Math.min(parsed.max_results ?? WEB_SEARCH.DEFAULT_MAX_RESULTS, WEB_SEARCH.MAX_RESULTS_LIMIT);

    let response: Response;

    try {
        response = await fetch(WEB_SEARCH.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: env.TAVILY_API_KEY,
                query: parsed.query,
                max_results: maxResults,
                search_depth: WEB_SEARCH.SEARCH_DEPTH,
                include_answer: true,
            }),
            signal: AbortSignal.timeout(WEB_SEARCH.TIMEOUT_MS),
        })
    } catch (err){
        // fetch() throw if network error / timeout
        const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
        throw new AppError(
            isTimeout
                ? `Web search timed out after ${WEB_SEARCH.TIMEOUT_MS / 1_000} seconds for query: "${parsed.query}"`
                : `Network error during web search: ${String(err)}`,
            isTimeout ? ERROR_CODE.TIMEOUT : ERROR_CODE.NETWORK,
            isTimeout ? HTTP_STATUS.SERVICE_UNAVAILABLE : HTTP_STATUS.BAD_GATEWAY,
        );
    }

    if (response.status === HTTP_STATUS.UNAUTHORIZED || response.status === HTTP_STATUS.FORBIDDEN){
        throw new AppError(
            'Tavily API key is invalid or unauthorized',
            ERROR_CODE.AUTH,
            HTTP_STATUS.UNAUTHORIZED,
        )
    }

    if(!response.ok){
        throw new AppError(
            `Tavily API returned unexpected status ${response.status}.`,
            ERROR_CODE.NETWORK,
            HTTP_STATUS.BAD_GATEWAY,
        )
    }

    const data = (await response.json()) as TavilyResponse;

    if(!data.results || data.results.length === 0){
        return `No results found for query: "${parsed.query}". Try repharsing or using a different search term.`
    }

    return formatResults(parsed.query, data);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(args:unknown): TavilySearchArgs{
    if (typeof args !== 'object' || args === null){
        throw new AppError(
            `${WEB_SEARCH.TOOL_NAME} requires an object argument with at least a "query" field.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        )
    }

    const obj = args as Record<string, unknown>;

    if (typeof obj['query'] !== 'string' || obj['query'].trim() === '') {
        throw new AppError(
            `${WEB_SEARCH.TOOL_NAME} "query" must be a non-empty string.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const maxResults =
        obj['max_results'] !== undefined ? Number(obj['max_results']) : undefined;

    if (maxResults !== undefined && (isNaN(maxResults) || maxResults < 1)) {
        throw new AppError(
            `${WEB_SEARCH.TOOL_NAME} "max_results" must be a positive number.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    return {
        query: obj['query'].trim(),
        max_results: maxResults,
    };
}

function formatResults(query: string, data: TavilyResponse): string {
    const lines: string[] = [`Search results for: "${query}"`, ''];

    if (data.answer) {
        lines.push(`Summary: ${data.answer}`, '');
    }

    data.results.forEach((result, index) => {
        lines.push(
            `[${index + 1}] ${result.title}`,
            `URL: ${result.url}`,
            `${result.content}`,
            '',
        );
    });

    return lines.join('\n').trim();
}
