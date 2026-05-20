import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { runAgent } from '../agent/orchestrator';
import { AgentStep } from '../llm/types';
import { env } from '../config/env';
import {
    createSession,
    createSessionWithId,
    createTask,
    updateTaskStatus,
    appendTaskStep,
    getSession,
    touchSession,
} from '../db/queries';

// ============================================================
// POST /api/agent/run
// Menerima message + sessionId, jalankan agent loop,
// stream setiap step ke frontend via SSE
// ============================================================

const router = Router();

// ─── Validation ───────────────────────────────────────────────────────────────

const runAgentSchema = z.object({
    message: z.string().min(1, 'Message tidak boleh kosong').max(2000),
    sessionId: z.string().uuid().optional(), // opsional — dibuat baru jika tidak ada
});

// ─── SSE Helpers ─────────────────────────────────────────────────────────────

function sseWrite(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Route Handler ────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
    // 1. Validasi input
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

    // 2. Set SSE headers — harus dilakukan sebelum res.write() pertama
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering jika ada proxy
    res.flushHeaders();

    res.write(': connected\n\n');

    // Track apakah client sudah disconnect
    let clientDisconnected = false;
    res.on('close', () => {
        clientDisconnected = true;
    });

    let taskId: string | null = null;

    try {
        // 3. Resolve session — pakai yang ada atau buat baru
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            ?? req.socket.remoteAddress
            ?? null;
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

        // 4. Buat task record di DB
        const task = await createTask({
            sessionId,
            userMessage: message,
            provider: env.LLM_PROVIDER,
            model: env.LLM_MODEL,
        });
        taskId = task.id;

        await updateTaskStatus(taskId, 'running');

        // 5. Emit event: start
        sseWrite(res, 'start', {
            sessionId,
            taskId,
            provider: env.LLM_PROVIDER,
            model: env.LLM_MODEL,
        });

        // 6. Jalankan agent loop — consume AsyncGenerator
        let finalAnswer: string | null = null;
        let lastIteration = 0;

        for await (const step of runAgent({ sessionId, userMessage: message })) {
            // Stop jika client sudah disconnect — hemat resource
            if (clientDisconnected) break;

            lastIteration = step.iteration ?? lastIteration;

            // Emit step ke frontend
            sseWrite(res, 'step', step);

            // Simpan step ke DB — map AgentStep type ke step_type DB
            await persistStep(taskId, step);

            // Tangkap final answer dari step
            if (step.type === 'final_answer') {
                finalAnswer = step.message ?? null;
            }
        }

        // 7. Update task status di DB
        if (!clientDisconnected) {
            await updateTaskStatus(taskId, 'done', {
                finalAnswer: finalAnswer ?? undefined,
                iterations: lastIteration,
            });

            // 8. Emit event: done
            sseWrite(res, 'done', { finalAnswer, taskId });
        }

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';

        // Update task status jika task sudah terbuat
        if (taskId) {
            try {
                await updateTaskStatus(taskId, 'error');
            } catch {
                // Jangan throw — kita sudah dalam catch block
            }
        }

        if (!clientDisconnected) {
            sseWrite(res, 'error', { message });
        }
    } finally {
        res.end();
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Map AgentStep ke format DB task_steps
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

            // final_answer dan error tidak disimpan sebagai step —
            // final_answer masuk ke kolom tasks.final_answer
            // error masuk ke tasks.status = 'error'
            default:
                break;
        }
    } catch {
        // Gagal persist step tidak boleh crash SSE stream
        // Log saja, agent loop tetap jalan
        console.error(`Gagal menyimpan step ke DB: taskId=${taskId}, type=${step.type}`);
    }
}

export default router;