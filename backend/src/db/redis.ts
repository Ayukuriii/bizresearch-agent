import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';

// ─── Constants ────────────────────────────────────────────────────────────────

const RECONNECT_MAX_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 500;

// ─── Client ───────────────────────────────────────────────────────────────────

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
    if (client && client.isReady) {
        return client;
    }

    client = createClient({
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

    client.on('error', (err: Error) => {
        console.error('Redis client error:', err.message);
    });

    client.on('reconnecting', () => {
        console.error('Redis: attempting to reconnect...');
    });

    await client.connect();

    return client;
}

export async function disconnectRedis(): Promise<void> {
    if (client && client.isReady) {
        await client.disconnect();
        client = null;
    }
}
