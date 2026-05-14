import { z } from 'zod';

const envSchema = z.object({
    // Server
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z.coerce.number().default(3001),

    // LLM
    LLM_PROVIDER: z.enum(['claude', 'gemini', 'groq']),
    LLM_MODEL: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_AI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),

    // Tools
    TAVILY_API_KEY: z.string(),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_URL: z.string().url(),

    // Auth
    JWT_SECRET: z.string().min(32, 'JWT_SECRET harus minimal 32 karakter'),

    // CORS
    FRONTEND_URL: z.string().url(),
});

function validateEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

        console.error('❌ Environment variable tidak valid:\n' + formatted);
        console.error('\nPastikan file .env sudah dibuat. Lihat .env.example sebagai template.');
        process.exit(1);
    }

    return result.data;
}

export const env = validateEnv();