export type SSEEventType = 'start' | 'step' | 'done' | 'error';

// Shape sesuai format SSE dari backend (src/routes/agent.ts)
export interface SSEStartPayload {
    sessionId: string;
    provider: string;
}

export interface SSEStepPayload {
    type: 'thinking' | 'tool_call' | 'tool_result';
    message?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    result?: string;
}

export interface SSEDonePayload {
    finalAnswer: string;
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

// Parse satu SSE "block" (dipisah \n\n) menjadi { event, data }
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

    // IIFE async supaya bisa pakai await tanpa mengubah signature fungsi
    (async () => {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: abortController.signal,
            });

            if (!response.ok || !response.body) {
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

                // SSE blocks dipisah oleh \n\n
                const blocks = buffer.split('\n\n');

                // Block terakhir mungkin belum lengkap — simpan kembali ke buffer
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
                        // Data bukan JSON valid — skip
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
                            handlers.onDone?.(payload as SSEDonePayload);
                            break;
                        case 'error':
                            handlers.onError?.(payload as SSEErrorPayload);
                            break;
                    }
                }
            }
        } catch (err) {
            // AbortError bukan error sungguhan — user cancel stream
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
