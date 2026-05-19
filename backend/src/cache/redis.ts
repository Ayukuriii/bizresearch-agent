import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';

// ============================================================
// Redis Client — singleton, dipakai oleh:
//   - src/agent/memory.ts  (conversation history)
//   - src/routes/health.ts (ping check)
// ============================================================

const RECONNECT_MAX_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 500;

export const redisClient = createClient({
    url: env.REDIS_URL,
    socket: {
        reconnectStrategy: (attempts) => {
            if (attempts >= RECONNECT_MAX_ATTEMPTS) {
                console.error(`Redis: max reconnect attempts (${RECONNECT_MAX_ATTEMPTS}) reached.`);
                return new Error('Redis max reconnect attempts reached');
            }

            return RECONNECT_DELAY_MS * attempts;
        },
    },
}) as RedisClientType;

redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
});

redisClient.on('reconnecting', () => {
    console.error('Redis: attempting to reconnect...');
});

export async function connectRedis(): Promise<void> {
    if (redisClient.isReady) {
        return;
    }

    await redisClient.connect();
    console.log('✅  Redis Connected');
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