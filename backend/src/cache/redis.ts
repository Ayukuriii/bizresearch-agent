import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';
import logger from '../lib/logger';

// ============================================================
// Redis Client — singleton, used by:
//   - src/agent/memory.ts  (conversation history)
//   - src/lib/cache.ts     (query result cache)
//   - src/routes/health.ts (ping check)
// ============================================================

const RECONNECT_MAX_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 500;

export const redisClient = createClient({
    url: env.REDIS_URL,
    socket: {
        reconnectStrategy: (attempts) => {
            if (attempts >= RECONNECT_MAX_ATTEMPTS) {
                logger.error(
                    { attempts },
                    'Redis: max reconnect attempts reached',
                );
                return new Error('Redis max reconnect attempts reached');
            }

            return RECONNECT_DELAY_MS * attempts;
        },
    },
}) as RedisClientType;

redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
});

redisClient.on('reconnecting', () => {
    logger.warn('Redis: attempting to reconnect...');
});

export async function connectRedis(): Promise<void> {
    if (redisClient.isReady) return;

    await redisClient.connect();
    logger.info('Redis connected');
}

export async function getRedisClient(): Promise<RedisClientType> {
    if (!redisClient.isReady) {
        await connectRedis();
    }

    return redisClient;
}

export async function disconnectRedis(): Promise<void> {
    if (redisClient.isReady) {
        await redisClient.disconnect();
    }
}