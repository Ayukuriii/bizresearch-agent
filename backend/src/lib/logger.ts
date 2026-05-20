import pino from 'pino';
import { env } from '../config/env';

// ============================================================
// Logger — pino singleton
//
// Development : pretty-printed, human-readable output
// Production  : structured JSON (consumed by log aggregators)
// ============================================================

const isDev = env.NODE_ENV === 'development';

const logger = pino({
    level: isDev ? 'debug' : 'info',
    ...(isDev && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
            },
        },
    }),
});

export default logger;