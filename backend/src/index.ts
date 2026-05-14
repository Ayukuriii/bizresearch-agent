import { env } from './config/env';
import { getLLMProvider } from './llm/factory';

async function main() {
    console.error(`Starting server — provider: ${env.LLM_PROVIDER}, port: ${env.PORT}`);

    try {
        const llm = getLLMProvider();

        const response = await llm.chat([
            {
                role: 'user',
                content: 'Jawab dengan satu kalimat: apa itu BizResearch Agent?',
            },
        ]);

        console.error('LLM response:', response.content);
        console.error('Tokens used:', response.usage);
    } catch (error) {
        console.error('LLM test gagal:', error);
    }
}

void main();