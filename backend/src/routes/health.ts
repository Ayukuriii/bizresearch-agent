import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { env } from '../config/env';

// ============================================================
// GET /api/health
// Dipakai frontend untuk:
//   1. Cek apakah server hidup
//   2. Tampilkan badge provider + model yang aktif
// ============================================================

const router = Router();

interface HealthData {
    status: 'ok' | 'degraded';
    uptime: number;
    provider: string;
    model: string;
    services: {
        postgres: 'ok' | 'error';
        redis: 'ok' | 'error';
    };
}

router.get('/', async (_req: Request, res: Response) => {
    const services: HealthData['services'] = {
        postgres: 'error',
        redis: 'error',
    };

    // Cek PostgreSQL
    try {
        await pool.query('SELECT 1');
        services.postgres = 'ok';
    } catch {
        // postgres tetap 'error'
    }

    // Cek Redis — import di sini untuk hindari circular dependency
    try {
        const { redisClient } = await import('../cache/redis');
        await redisClient.ping();
        services.redis = 'ok';
    } catch {
        // redis tetap 'error'
    }

    const allOk = Object.values(services).every((s) => s === 'ok');

    const data: HealthData = {
        status: allOk ? 'ok' : 'degraded',
        uptime: Math.floor(process.uptime()),
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL,
        services,
    };

    // Tetap return 200 meskipun degraded — biarkan frontend yang putuskan
    // Return 503 hanya jika server sendiri yang bermasalah
    res.status(200).json({ success: true, data });
});

export default router;