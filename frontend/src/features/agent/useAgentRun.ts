import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSSEClient } from '@/lib/sseClient.ts';
import type { SSEClient } from '@/lib/sseClient.ts';
import { useAgentStore } from '@/store/agentStore.ts';

const API_BASE = import.meta.env.VITE_API_URL as string;

export function useAgentRun() {
    const sseClientRef = useRef<SSEClient | null>(null);
    const queryClient = useQueryClient();

    const { sessionId, status, addStep, setFinalAnswer, setStatus } =
        useAgentStore();

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            sseClientRef.current?.cancel();
        };
    }, []);

    const run = useCallback(
        (message: string) => {
            // Prevent concurrent runs
            if (status === 'running') return;

            // Cancel any lingering stream before starting a new one
            sseClientRef.current?.cancel();

            setStatus('running');

            sseClientRef.current = createSSEClient(
                `${API_BASE}/agent/run`,
                { message, sessionId },
                {
                    onStart: () => {
                        // Stream confirmed open — status already set to 'running' above
                    },
                    onStep: (payload) => {
                        addStep(payload);
                    },
                    onDone: (payload) => {
                        setFinalAnswer(payload.finalAnswer);
                        setStatus('done');
                        queryClient.invalidateQueries({ queryKey: ['history', sessionId] });
                        sseClientRef.current = null;
                    },
                    onError: (payload) => {
                        console.error('[useAgentRun] stream error:', payload.message);
                        setStatus('error');
                        queryClient.invalidateQueries({ queryKey: ['history', sessionId] });
                        sseClientRef.current = null;
                    },
                }
            );
        },
        [status, sessionId, addStep, setFinalAnswer, setStatus, queryClient]
    );

    const cancel = useCallback(() => {
        sseClientRef.current?.cancel();
        sseClientRef.current = null;
        setStatus('idle');
    }, [setStatus]);

    return { run, cancel };
}