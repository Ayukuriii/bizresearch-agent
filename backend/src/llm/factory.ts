import { env } from '../config/env';
import { GeminiAdapter } from './adapters/gemini';
import type { LLMProvider } from './types';
import {ClaudeAdapter} from "./adapters/claude";

// Singleton instance — adapter hanya dibuat sekali
// dan di-reuse selama server hidup
let instance: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
    if (instance !== null) {
        return instance;
    }

    switch (env.LLM_PROVIDER) {
        case 'gemini':
            instance = new GeminiAdapter();
            break;

        case 'claude':
            instance = new ClaudeAdapter();
            break;

        default:
            throw new Error(
                `LLM provider tidak dikenal: ${String(env.LLM_PROVIDER)}`
            );
    }

    return instance;
}

// Dipakai saat testing — reset singleton agar adapter baru bisa dibuat
export function resetLLMProvider(): void {
    instance = null;
}