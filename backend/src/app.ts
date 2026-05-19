import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { AppError } from './utils/errors';
import healthRouter from './routes/health';
import agentRouter from './routes/agent';
import historyRouter from './routes/history';

// ============================================================
// Express App
// ============================================================

const app: Application = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/health', healthRouter);
app.use('/api/agent/run', agentRouter);
app.use('/api/history', historyRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint tidak ditemukan',
        },
    });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Harus 4 parameter agar Express mengenalinya sebagai error handler

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
            },
        });
        return;
    }

    // Error tidak terduga — log dan return 500
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Terjadi kesalahan internal',
        },
    });
});

export default app;