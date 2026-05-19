import { runAgent } from './src/agent/orchestrator';

async function main(): Promise<void> {
    const sessionId = 'test-agent-001';
    const userMessage = 'Give me a brief overview of Anthropic as a company.';

    console.log('Starting agent...\n');

    for await (const step of runAgent({ sessionId, userMessage })) {
        switch (step.type) {
            case 'thinking':
                console.log(`[THINKING] ${step.message}`);
                break;
            case 'tool_call':
                console.log(`[TOOL CALL] ${step.toolName}`, step.args);
                break;
            case 'tool_result':
                console.log(`[TOOL RESULT] ${step.toolName}: ${step.result?.slice(0, 100)}...`);
                break;
            case 'final_answer':
                console.log(`\n[FINAL ANSWER]\n${step.message}`);
                break;
            case 'error':
                console.error(`[ERROR] ${step.message}`);
                break;
        }
    }
}

main();
