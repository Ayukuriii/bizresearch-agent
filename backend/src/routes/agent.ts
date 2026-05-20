import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { runAgent } from '../agent/orchestrator';
import { AgentStep } from '../llm/types';
import { env } from '../config/env';
import logger from '../lib/logger';
import {
    createSession,
    createSessionWithId,
    createTask,
    updateTaskStatus,
    appendTaskStep,
    getSession,
    touchSession,
} from '../db/queries';
import { getCachedAnswer, setCachedAnswer } from '../lib/cache';

// ============================================================
// POST /api/agent/run
// Accepts message + sessionId, runs the agent loop,
// streams each step to the frontend via SSE
// ============================================================

const router = Router();

// ─── Validation ───────────────────────────────────────────────────────────────

const runAgentSchema = z.object({
    message: z.string().min(1, 'Message must not be empty').max(2000),
    sessionId: z.string().uuid().optional(), // optional — new session created if absent
});

// ─── SSE Helpers ─────────────────────────────────────────────────────────────

function sseWrite(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Route Handler ────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
    // 1. Validate input
    const parsed = runAgentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: parsed.error.flatten().fieldErrors,
            },
        });
        return;
    }

    const { message, sessionId: incomingSessionId } = parsed.data;

    // 2. Set SSE headers — must be done before first res.write()
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering if behind proxy
    res.flushHeaders();

    res.write(': connected\n\n');

    // Track whether client has disconnected
    let clientDisconnected = false;
    res.on('close', () => {
        clientDisconnected = true;
    });

    let taskId: string | null = null;

    try {
        // 3. Resolve session — use existing or create new
        const ipAddress =
            (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
            req.socket.remoteAddress ??
            null;
        const userAgent = req.headers['user-agent'] ?? null;

        let sessionId: string;

        if (incomingSessionId) {
            const existing = await getSession(incomingSessionId);
            if (existing) {
                await touchSession(incomingSessionId);
            } else {
                await createSessionWithId(incomingSessionId, ipAddress, userAgent);
            }
            sessionId = incomingSessionId;
        } else {
            const session = await createSession(ipAddress, userAgent);
            sessionId = session.id;
        }

        // 4. Create task record in DB
        const task = await createTask({
            sessionId,
            userMessage: message,
            provider: env.LLM_PROVIDER,
            model: env.LLM_MODEL,
        });
        taskId = task.id;

        logger.info({ taskId, sessionId, provider: env.LLM_PROVIDER }, 'Task created');

        await updateTaskStatus(taskId, 'running');

        // 5. Emit start event
        sseWrite(res, 'start', {
            sessionId,
            taskId,
            provider: env.LLM_PROVIDER,
            model: env.LLM_MODEL,
        });

        // ── Cache check ───────────────────────────────────────────────────────────
        // Check if an identical query was already answered in this session.
        // On hit: stream the cached answer and skip the agent loop entirely.
        // On miss: fall through to the agent loop, cache the answer on completion.
        const cachedAnswer = await getCachedAnswer(sessionId, message);

        if (cachedAnswer !== null) {
            logger.info({ taskId, sessionId }, 'Serving response from query cache');

            await updateTaskStatus(taskId, 'done', {
                finalAnswer: cachedAnswer,
                iterations: 0,
            });

            sseWrite(res, 'done', { finalAnswer: cachedAnswer, taskId, fromCache: true });

            return; // finally block still runs — res.end() will be called
        }
        // ─────────────────────────────────────────────────────────────────────────

        // 6. Run agent loop — consume AsyncGenerator
        let finalAnswer: string | null = null;
        let lastIteration = 0;

        for await (const step of runAgent({ sessionId, userMessage: message })) {
            // Stop if client disconnected — conserve resources
            if (clientDisconnected) break;

            lastIteration = step.iteration ?? lastIteration;

            // Emit step to frontend
            sseWrite(res, 'step', step);

            // Persist step to DB
            await persistStep(taskId, step);

            // Capture final answer from step
            if (step.type === 'final_answer') {
                finalAnswer = step.message ?? null;
            }
        }

        // 7. Update task status in DB
        if (!clientDisconnected) {
            await updateTaskStatus(taskId, 'done', {
                finalAnswer: finalAnswer ?? undefined,
                iterations: lastIteration,
            });

            // Store answer in cache for future identical queries
            if (finalAnswer !== null) {
                await setCachedAnswer(sessionId, message, finalAnswer);
            }

            // 8. Emit done event
            sseWrite(res, 'done', { finalAnswer, taskId });

            logger.info({ taskId, iterations: lastIteration }, 'Task completed');
        }

    } catch (err) {
        const errorMessage =
            err instanceof Error ? err.message : 'An unexpected error occurred';

        logger.error({ err, taskId }, 'Agent route encountered an unhandled error');

        if (taskId) {
            try {
                await updateTaskStatus(taskId, 'error');
            } catch {
                // Already in catch — do not re-throw
            }
        }

        if (!clientDisconnected) {
            sseWrite(res, 'error', { message: errorMessage });
        }
    } finally {
        res.end();
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Map AgentStep to DB task_steps format
async function persistStep(taskId: string, step: AgentStep): Promise<void> {
    try {
        switch (step.type) {
            case 'thinking':
                await appendTaskStep({
                    taskId,
                    stepType: 'thinking',
                    payload: { message: step.message },
                    iteration: step.iteration ?? 1,
                });
                break;

            case 'tool_call':
                await appendTaskStep({
                    taskId,
                    stepType: 'tool_call',
                    payload: { toolName: step.toolName, args: step.args },
                    iteration: step.iteration ?? 1,
                });
                break;

            case 'tool_result':
                await appendTaskStep({
                    taskId,
                    stepType: 'tool_result',
                    payload: { toolName: step.toolName, result: step.result },
                    iteration: step.iteration ?? 1,
                });
                break;

            // final_answer and error are not stored as steps —
            // final_answer goes to tasks.final_answer column
            // error goes to tasks.status = 'error'
            default:
                break;
        }
    } catch {
        // Step persist failure must not crash the SSE stream
        logger.error({ taskId, stepType: step.type }, 'Failed to persist step to DB');
    }
}

export default router;