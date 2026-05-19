// ─── HTTP Status ──────────────────────────────────────────────────────────────

export const HTTP_STATUS = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
} as const;

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const ERROR_CODE = {
    TIMEOUT: 'TOOL_TIMEOUT',
    NETWORK: 'TOOL_NETWORK_ERROR',
    AUTH: 'TOOL_AUTH',
    INVALID_ARGS: 'TOOL_INVALID_ARGS',
    INVALID_CONTENT: 'TOOL_INVALID_CONTENT',
} as const;

// ─── Web Search ──────────────────────────────────────────────────────────────

export const WEB_SEARCH = {
    TOOL_NAME:'web_search',
    API_URL:'https://api.tavily.com/search',
    SEARCH_DEPTH: 'basic',
    DEFAULT_MAX_RESULTS: 5,
    MAX_RESULTS_LIMIT: 10,
    TIMEOUT_MS: 10_000,
} as const;

// ─── Scraper ──────────────────────────────────────────────────────────────────

export const SCRAPER = {
    TOOL_NAME: 'scrape_url',
    MAX_CONTENT_LENGTH: 3_000,
    TIMEOUT_MS: 15_000,
    CONTENT_SELECTORS: ['article', 'main', 'body'] as const,
    STRIP_TAGS: ['script', 'style', 'noscript', 'iframe'] as const,
} as const;

// ─── Summarizer ──────────────────────────────────────────────────────────────────

export const SUMMARIZER = {
    TOOL_NAME: 'summarize',
    MAX_INPUT_LENGTH: 10_000,
} as const;