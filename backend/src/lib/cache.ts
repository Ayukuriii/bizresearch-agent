import { createHash } from 'crypto';
import { redisClient } from '../cache/redis';
import logger from './logger';

// ============================================================
// Query Result Cache
//
// Caches agent final answers in Redis keyed by a hash of
// (sessionId + normalised message). This avoids re-running
// the full agent loop for identical queries within the same
// session.
//
// Key pattern : cache:query:{sha256}
// TTL         : 1 hour (3600 seconds)
// ============================================================

const CACHE_PREFIX = 'cache:query:';
const CACHE_TTL_SECONDS = 3600;

// ─── Key Builder ─────────────────────────────────────────────────────────────

/**
 * Builds a deterministic Redis key from sessionId + message.
 * Message is lower-cased and trimmed before hashing so that
 * "Tell me about Apple" and "tell me about apple" share a cache entry.
 */
function buildCacheKey(sessionId: string, message: string): string {
    const normalised = message.toLowerCase().trim();
    const hash = createHash('sha256')
        .update(`${sessionId}:${normalised}`)
        .digest('hex');

    return `${CACHE_PREFIX}${hash}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the cached final answer for this (sessionId, message) pair,
 * or null if no cache entry exists.
 * Never throws — a cache miss is not an error.
 */
export async function getCachedAnswer(
    sessionId: string,
    message: string,
): Promise<string | null> {
    try {
        const key = buildCacheKey(sessionId, message);
        const value = await redisClient.get(key);

        if (value !== null) {
            logger.debug({ sessionId, key }, 'Query cache hit');
        }

        return value;
    } catch (err) {
        // Cache read failure must not block the agent from running
        logger.error({ err, sessionId }, 'Failed to read from query cache');
        return null;
    }
}

/**
 * Stores the final answer for this (sessionId, message) pair.
 * TTL is fixed at CACHE_TTL_SECONDS.
 * Never throws — a cache write failure is non-fatal.
 */
export async function setCachedAnswer(
    sessionId: string,
    message: string,
    answer: string,
): Promise<void> {
    try {
        const key = buildCacheKey(sessionId, message);
        await redisClient.set(key, answer, { EX: CACHE_TTL_SECONDS });

        logger.debug({ sessionId, key, ttl: CACHE_TTL_SECONDS }, 'Query cache set');
    } catch (err) {
        // Cache write failure must not affect the response already sent to client
        logger.error({ err, sessionId }, 'Failed to write to query cache');
    }
}

/**
 * Explicitly removes the cache entry for this (sessionId, message) pair.
 * Useful if the user re-runs the same query and expects a fresh result.
 * Never throws.
 */
export async function invalidateCachedAnswer(
    sessionId: string,
    message: string,
): Promise<void> {
    try {
        const key = buildCacheKey(sessionId, message);
        await redisClient.del(key);

        logger.debug({ sessionId, key }, 'Query cache invalidated');
    } catch (err) {
        logger.error({ err, sessionId }, 'Failed to invalidate query cache');
    }
}