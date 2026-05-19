import app from './app';
import { env } from './config/env';
import { connectDB } from './db';
import { connectRedis } from './cache/redis';

// ============================================================
// Server Entry Point
// Urutan startup:
//   1. Koneksi PostgreSQL
//   2. Koneksi Redis
//   3. Express listen
// Jika salah satu gagal → proses exit dengan kode 1
// ============================================================

async function bootstrap(): Promise<void> {
    try {
        // 1. PostgreSQL
        await connectDB();

        // 2. Redis
        await connectRedis();

        // 3. Start server
        app.listen(env.PORT, () => {
            console.log(`✅  Server berjalan di http://localhost:${env.PORT}`);
            console.log(`    Provider : ${env.LLM_PROVIDER}`);
            console.log(`    Model    : ${env.LLM_MODEL}`);
            console.log(`    Env      : ${env.NODE_ENV}`);
        });
    } catch (err) {
        console.error('❌  Gagal menjalankan server:', err);
        process.exit(1);
    }
}

bootstrap();