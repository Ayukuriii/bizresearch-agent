import app from './app';
import { env } from './config/env';
import { connectDB } from './db';
import { connectRedis } from './cache/redis';
import logger from './lib/logger';

// ============================================================
// Server Entry Point
// Startup order:
//   1. PostgreSQL connection
//   2. Redis connection
//   3. Express listen
// Any failure → process exits with code 1
// ============================================================

async function bootstrap(): Promise<void> {
    try {
        // 1. PostgreSQL
        await connectDB();

        // 2. Redis
        await connectRedis();

        // 3. Start server
        app.listen(env.PORT, () => {
            logger.info(
                {
                    port: env.PORT,
                    provider: env.LLM_PROVIDER,
                    model: env.LLM_MODEL,
                    env: env.NODE_ENV,
                },
                'Server started',
            );
        });
    } catch (err) {
        logger.error({ err }, 'Failed to start server');
        process.exit(1);
    }
}

bootstrap();