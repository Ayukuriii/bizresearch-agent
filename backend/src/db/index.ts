import { Pool } from 'pg';
import { env } from '../config/env';

// ============================================================
// Connection Pool
// Pool dibuat sekali dan di-reuse di seluruh aplikasi
// ============================================================

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    // Batas koneksi — cukup untuk dev, naikkan di production
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

// Verifikasi koneksi saat startup
pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
});

export async function connectDB(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        console.log('✅  PostgreSQL terhubung');
    } finally {
        client.release();
    }
}