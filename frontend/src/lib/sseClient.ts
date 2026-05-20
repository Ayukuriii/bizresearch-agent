export type SSEEventType = 'start' | 'step' | 'done' | 'error';

// Payload shapes match backend format (src/routes/agent.ts)
export interface SSEStartPayload {
    sessionId: string;
    provider: string;
}

export interface SSEStepPayload {
    type: 'thinking' | 'tool_call' | 'tool_result' | 'final_answer';
    message?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    result?: string;
    iteration?: number;
}

export interface SSEDonePayload {
    finalAnswer: string;
    taskId?: string;
    fromCache?: boolean;
}

export interface SSEErrorPayload {
    message: string;
}

export interface SSEHandlers {
    onStart?: (payload: SSEStartPayload) => void;
    onStep?: (payload: SSEStepPayload) => void;
    onDone?: (payload: SSEDonePayload) => void;
    onError?: (payload: SSEErrorPayload) => void;
}

export interface SSEClient {
    cancel: () => void;
}

// Parse one SSE block (separated by \n\n) into { event, data }
function parseSSEBlock(block: string): { event: string; data: string } | null {
    const lines = block.split('\n');
    let event = 'message';
    let data = '';

    for (const line of lines) {
        if (line.startsWith('event:')) {
            event = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
            data = line.slice('data:'.length).trim();
        }
    }

    if (!data) return null;
    return { event, data };
}

export function createSSEClient(
    url: string,
    body: Record<string, unknown>,
    handlers: SSEHandlers
): SSEClient {
    const abortController = new AbortController();

    (async () => {
        // Track whether a clean done/error event was received.
        // If the stream closes without one, we fire onError so the
        // UI is never left stuck in 'running' state.
        let cleanlyFinished = false;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: abortController.signal,
            });

            if (!response.ok || !response.body) {
                cleanlyFinished = true;
                handlers.onError?.({
                    message: `Server responded with status ${response.status}`,
                });
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // SSE blocks are separated by \n\n
                const blocks = buffer.split('\n\n');

                // Last block may be incomplete — hold it in the buffer
                buffer = blocks.pop() ?? '';

                for (const block of blocks) {
                    const trimmed = block.trim();
                    if (!trimmed) continue;

                    const parsed = parseSSEBlock(trimmed);
                    if (!parsed) continue;

                    let payload: unknown;
                    try {
                        payload = JSON.parse(parsed.data);
                    } catch {
                        // Data is not valid JSON — skip
                        continue;
                    }

                    switch (parsed.event as SSEEventType) {
                        case 'start':
                            handlers.onStart?.(payload as SSEStartPayload);
                            break;
                        case 'step':
                            handlers.onStep?.(payload as SSEStepPayload);
                            break;
                        case 'done':
                            cleanlyFinished = true;
                            handlers.onDone?.(payload as SSEDonePayload);
                            break;
                        case 'error':
                            cleanlyFinished = true;
                            handlers.onError?.(payload as SSEErrorPayload);
                            break;
                    }
                }
            }

            // Stream ended — if no done/error event was received,
            // the connection dropped unexpectedly
            if (!cleanlyFinished) {
                handlers.onError?.({
                    message: 'Stream closed unexpectedly. The server may have crashed or the connection was dropped.',
                });
            }

        } catch (err) {
            // AbortError is not a real error — user cancelled the stream
            if (err instanceof DOMException && err.name === 'AbortError') return;

            handlers.onError?.({
                message: err instanceof Error ? err.message : 'Unknown stream error',
            });
        }
    })();

    return {
        cancel: () => abortController.abort(),
    };
}