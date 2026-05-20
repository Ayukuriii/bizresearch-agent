// ============================================================
// Frontend logger — dev: console output / prod: silent
// Drop-in replacement for console.* calls across the frontend.
// ============================================================

const isDev = import.meta.env.DEV;

const logger = {
    info: (...args: unknown[]): void => {
        if (isDev) console.info('[info]', ...args);
    },
    warn: (...args: unknown[]): void => {
        if (isDev) console.warn('[warn]', ...args);
    },
    error: (...args: unknown[]): void => {
        if (isDev) console.error('[error]', ...args);
    },
    debug: (...args: unknown[]): void => {
        if (isDev) console.debug('[debug]', ...args);
    },
};

export default logger;