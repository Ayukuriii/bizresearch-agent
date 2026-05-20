import { z } from 'zod';

// ============================================================
// Environment Schema
// ============================================================

const envSchema = z
    .object({
        // Server
        NODE_ENV: z
            .enum(['development', 'production', 'test'])
            .default('development'),
        PORT: z.coerce.number().default(3001),

        // LLM
        LLM_PROVIDER: z.enum(['claude', 'gemini'], {
            error: "LLM_PROVIDER must be 'claude' or 'gemini'",
        }),
        LLM_MODEL: z.string().min(1, 'LLM_MODEL must not be empty'),
        ANTHROPIC_API_KEY: z.string().optional(),
        GOOGLE_AI_API_KEY: z.string().optional(),

        // Tools
        TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY is required'),

        // Database
        DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

        // Redis
        REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

        // Auth
        JWT_SECRET: z
            .string()
            .min(32, 'JWT_SECRET must be at least 32 characters'),

        // CORS
        FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
    })
    // Cross-field validation: the API key for the active provider must be present
    .refine(
        (data) =>
            data.LLM_PROVIDER !== 'claude' ||
            (data.ANTHROPIC_API_KEY !== undefined &&
                data.ANTHROPIC_API_KEY.length > 0),
        {
            message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude',
            path: ['ANTHROPIC_API_KEY'],
        }
    )
    .refine(
        (data) =>
            data.LLM_PROVIDER !== 'gemini' ||
            (data.GOOGLE_AI_API_KEY !== undefined &&
                data.GOOGLE_AI_API_KEY.length > 0),
        {
            message: 'GOOGLE_AI_API_KEY is required when LLM_PROVIDER=gemini',
            path: ['GOOGLE_AI_API_KEY'],
        }
    );

// ============================================================
// Validation
// ============================================================

function validateEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

        console.error('❌ Invalid environment variables:\n' + formatted);
        console.error(
            '\nEnsure .env file exists. See .env.example for reference.'
        );
        process.exit(1);
    }

    return result.data;
}

export const env = validateEnv();