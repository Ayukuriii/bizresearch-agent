import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getTasksBySession, getTaskWithSteps } from '../db/queries';

// ============================================================
// History Routes
// GET /api/history/:sessionId     → list semua tasks dalam session
// GET /api/history/task/:taskId   → detail satu task + semua steps
// ============================================================

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const uuidSchema = z.string().uuid('ID harus berformat UUID');

// ─── GET /api/history/:sessionId ─────────────────────────────────────────────

router.get('/:sessionId', async (req: Request, res: Response) => {
    const parsed = uuidSchema.safeParse(req.params.sessionId);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'sessionId harus berformat UUID',
            },
        });
        return;
    }

    try {
        const tasks = await getTasksBySession(parsed.data);

        res.status(200).json({
            success: true,
            data: {
                sessionId: parsed.data,
                total: tasks.length,
                tasks,
            },
        });
    } catch (err) {
        console.error('Gagal mengambil history session:', err);
        res.status(500).json({
            success: false,
            error: {
                code: 'DB_ERROR',
                message: 'Gagal mengambil history session',
            },
        });
    }
});

// ─── GET /api/history/task/:taskId ───────────────────────────────────────────

router.get('/task/:taskId', async (req: Request, res: Response) => {
    const parsed = uuidSchema.safeParse(req.params.taskId);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'taskId harus berformat UUID',
            },
        });
        return;
    }

    try {
        const task = await getTaskWithSteps(parsed.data);

        if (!task) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Task dengan ID ${parsed.data} tidak ditemukan`,
                },
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: task,
        });
    } catch (err) {
        console.error('Gagal mengambil detail task:', err);
        res.status(500).json({
            success: false,
            error: {
                code: 'DB_ERROR',
                message: 'Gagal mengambil detail task',
            },
        });
    }
});

export default router;