import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSSEClient } from '@/lib/sseClient.ts';
import type { SSEClient } from '@/lib/sseClient.ts';
import { useAgentStore } from '@/store/agentStore.ts';
import logger from '@/lib/logger.ts';

const API_BASE = import.meta.env.VITE_API_URL as string;

export function useAgentRun() {
    const sseClientRef = useRef<SSEClient | null>(null);
    const queryClient = useQueryClient();

    const { sessionId, status, addStep, setFinalAnswer, setStatus, setFromCache } =
        useAgentStore();

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            sseClientRef.current?.cancel();
        };
    }, []);

    const run = useCallback(
        (message: string) => {
            if (status === 'running') return;

            sseClientRef.current?.cancel();
            setStatus('running');
            setFromCache(false);

            sseClientRef.current = createSSEClient(
                `${API_BASE}/agent/run`,
                { message, sessionId },
                {
                    onStart: () => {
                        // Stream confirmed open — status already 'running'
                    },
                    onStep: (payload) => {
                        addStep(payload);
                    },
                    onDone: (payload) => {
                        setFinalAnswer(payload.finalAnswer);
                        setFromCache(payload.fromCache ?? false);
                        setStatus('done');
                        queryClient.invalidateQueries({ queryKey: ['history', sessionId] });
                        sseClientRef.current = null;
                    },
                    onError: (payload) => {
                        logger.error('[useAgentRun] stream error:', payload.message);
                        setStatus('error');
                        queryClient.invalidateQueries({ queryKey: ['history', sessionId] });
                        sseClientRef.current = null;
                    },
                }
            );
        },
        [status, sessionId, addStep, setFinalAnswer, setStatus, setFromCache, queryClient]
    );

    const cancel = useCallback(() => {
        sseClientRef.current?.cancel();
        sseClientRef.current = null;
        setStatus('idle');
    }, [setStatus]);

    return { run, cancel };
}