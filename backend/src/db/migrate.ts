/**
 * src/db/migrate.ts
 *
 * Jalankan sekali untuk setup schema di database baru:
 *   npx tsx src/db/migrate.ts
 *
 * Script ini aman dijalankan berulang kali (semua CREATE pakai IF NOT EXISTS)
 */

import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('[migrate] ERROR: DATABASE_URL tidak ditemukan di environment.');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate(): Promise<void> {
    const client = await pool.connect();

    try {
        console.log('[migrate] Connecting to database...');

        const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('[migrate] Running schema.sql...');
        await client.query(schemaSql);

        console.log('[migrate] ✅ Migration complete. Tables created (if not exists):');
        console.log('  - sessions');
        console.log('  - tasks');
        console.log('  - task_steps');

        // Verifikasi tabel benar-benar ada
        const result = await client.query<{ tablename: string }>(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('sessions', 'tasks', 'task_steps')
      ORDER BY tablename
    `);

        console.log('\n[migrate] Verified tables in DB:');
        result.rows.forEach(row => console.log(`  ✓ ${row.tablename}`));

    } catch (error) {
        console.error('[migrate] ❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();