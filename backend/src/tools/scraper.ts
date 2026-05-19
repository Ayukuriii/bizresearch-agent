import * as cheerio from 'cheerio'
import {LLMTool} from "../llm/types";
import {ERROR_CODE, HTTP_STATUS, SCRAPER} from "./constants";
import {AppError} from "../utils/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapeArgs {
    url: string;
}

// ─── Tool Definition ──────────────────────────────────────────────────────────

export const scrapeTool: LLMTool = {
    name: SCRAPER.TOOL_NAME,
    description:
        'Scrape and extract the main text content from a webpage URL. Use this after ' +
        'web_search when you need the full content of a specific page, not just the snippet. ' +
        'Returns cleaned text content from the page.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The full URL of the webpage to scrape, including https://.',
            },
        },
        required: ['url'],
    },
};

// ─── Execution ────────────────────────────────────────────────────────────────

export async function executeScrape(args: unknown): Promise<string> {
    const parsed = parseArgs(args);

    const html = await fetchHtml(parsed.url);

    return extractText(html, parsed.url);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(args: unknown): ScrapeArgs {
    if (typeof args !== 'object' || args === null) {
        throw new AppError(
            `${SCRAPER.TOOL_NAME} requires an object argument with a "url" field.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const obj = args as Record<string, unknown>;

    if (typeof obj['url'] !== 'string' || obj['url'].trim() === '') {
        throw new AppError(
            `${SCRAPER.TOOL_NAME} "url" must be a non-empty string.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const url = obj['url'].trim();

    if (!isValidHttpUrl(url)) {
        throw new AppError(
            `${SCRAPER.TOOL_NAME} "url" must be a valid HTTP or HTTPS URL.`,
            ERROR_CODE.INVALID_ARGS,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    return { url };
}

function isValidHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

async function fetchHtml(url: string): Promise<string> {
    let response: Response;

    try {
        response = await fetch(url, {
            headers: {
                // Some sites reject request without User-Agent
                'User-Agent': 'Mozilla/5.0 (compatible; BizResearchBot/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: AbortSignal.timeout(SCRAPER.TIMEOUT_MS),
            redirect: 'follow',
        });
    } catch (err) {
        const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
        throw new AppError(
            isTimeout
                ? `Scraper timed out after ${SCRAPER.TIMEOUT_MS / 1_000} seconds for URL: "${url}"`
                : `Network error while scraping "${url}": ${String(err)}`,
            isTimeout ? ERROR_CODE.TIMEOUT : ERROR_CODE.NETWORK,
            isTimeout ? HTTP_STATUS.SERVICE_UNAVAILABLE : HTTP_STATUS.BAD_GATEWAY,
        );
    }

    if (!response.ok) {
        throw new AppError(
            `Failed to fetch "${url}" — server returned status ${response.status}.`,
            ERROR_CODE.NETWORK,
            HTTP_STATUS.BAD_GATEWAY,
        );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new AppError(
            `URL "${url}" returned non-HTML content (${contentType}). Only HTML pages are supported.`,
            ERROR_CODE.INVALID_CONTENT,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    return response.text();
}

function extractText(html: string, url: string): string {
    const $ = cheerio.load(html);

    // Delete tags that don't contain useful content
    $(SCRAPER.STRIP_TAGS.join(', ')).remove();

    // Search for the main content based on priority selectors
    let content = '';
    for (const selector of SCRAPER.CONTENT_SELECTORS) {
        const text = $(selector).first().text();
        if (text.trim().length > 0) {
            content = text;
            break;
        }
    }

    if (!content.trim()) {
        throw new AppError(
            `Could not extract readable content from "${url}". The page may be JavaScript-rendered or empty.`,
            ERROR_CODE.INVALID_CONTENT,
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    return truncateAndClean(content);
}

function truncateAndClean(text: string): string {
    const cleaned = text
        .replace(/\t/g, ' ')        // tab → space
        .replace(/[ ]{2,}/g, ' ')   // multiple space → one space
        .replace(/\n{3,}/g, '\n\n') // more than 2 newline → 2 newline
        .trim();

    if (cleaned.length <= SCRAPER.MAX_CONTENT_LENGTH) {
        return cleaned;
    }

    return cleaned.slice(0, SCRAPER.MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
}
