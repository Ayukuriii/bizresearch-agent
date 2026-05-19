import { getRedisClient } from '../db/redis';
import { LLMMessage } from '../llm/types';
import { AppError } from '../utils/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_TTL_SECONDS = 86_400; // 24 jam
const KEY_PREFIX = 'session';
const KEY_SUFFIX = 'history';

const ERROR_CODE = {
    MEMORY_READ: 'MEMORY_READ_ERROR',
    MEMORY_WRITE: 'MEMORY_WRITE_ERROR',
    MEMORY_DELETE: 'MEMORY_DELETE_ERROR',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildKey(sessionId: string): string {
    return `${KEY_PREFIX}:${sessionId}:${KEY_SUFFIX}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getHistory(sessionId: string): Promise<LLMMessage[]> {
    try {
        const redis = await getRedisClient();
        const raw = await redis.get(buildKey(sessionId));

        if (raw === null) {
            return [];
        }

        return JSON.parse(raw) as LLMMessage[];
    } catch (err) {
        throw new AppError(
            `Failed to read conversation history for session "${sessionId}": ${String(err)}`,
            ERROR_CODE.MEMORY_READ,
            500,
        );
    }
}

export async function appendHistory(
    sessionId: string,
    messages: LLMMessage[],
): Promise<void> {
    if (messages.length === 0) return;

    try {
        const redis = await getRedisClient();
        const key = buildKey(sessionId);

        const existing = await getHistory(sessionId);
        const updated = [...existing, ...messages];

        await redis.set(key, JSON.stringify(updated), {
            EX: SESSION_TTL_SECONDS,
        });
    } catch (err) {
        if (err instanceof AppError) throw err;

        throw new AppError(
            `Failed to append conversation history for session "${sessionId}": ${String(err)}`,
            ERROR_CODE.MEMORY_WRITE,
            500,
        );
    }
}

export async function clearHistory(sessionId: string): Promise<void> {
    try {
        const redis = await getRedisClient();
        await redis.del(buildKey(sessionId));
    } catch (err) {
        throw new AppError(
            `Failed to clear conversation history for session "${sessionId}": ${String(err)}`,
            ERROR_CODE.MEMORY_DELETE,
            500,
        );
    }
}
