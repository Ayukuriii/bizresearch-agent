import { create } from 'zustand';
import type { SSEStepPayload } from '../lib/sseClient';

export type { SSEStepPayload as AgentStep };

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentState {
    // — State —
    sessionId: string;
    steps: SSEStepPayload[];
    finalAnswer: string | null;
    status: AgentStatus;
    activeProvider: string | null;
    fromCache: boolean;
    pendingPrompt: string | null;  // set by DemoSidebar, consumed by AgentChat

    // — Actions —
    addStep: (step: SSEStepPayload) => void;
    setFinalAnswer: (answer: string) => void;
    setStatus: (status: AgentStatus) => void;
    setProvider: (provider: string) => void;
    setFromCache: (fromCache: boolean) => void;
    setPendingPrompt: (prompt: string | null) => void;
    resetSession: () => void;
}

function getOrCreateSessionId(): string {
    const KEY = 'bizresearch_session_id';
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;

    const fresh = crypto.randomUUID();
    sessionStorage.setItem(KEY, fresh);
    return fresh;
}

export const useAgentStore = create<AgentState>((set) => ({
    // — Initial state —
    sessionId: getOrCreateSessionId(),
    steps: [],
    finalAnswer: null,
    status: 'idle',
    activeProvider: null,
    fromCache: false,
    pendingPrompt: null,

    // — Actions —
    addStep: (step) =>
        set((state) => ({ steps: [...state.steps, step] })),

    setFinalAnswer: (answer) =>
        set({ finalAnswer: answer }),

    setStatus: (status) =>
        set({ status }),

    setProvider: (provider) =>
        set({ activeProvider: provider }),

    setFromCache: (fromCache) =>
        set({ fromCache }),

    setPendingPrompt: (prompt) =>
        set({ pendingPrompt: prompt }),

    resetSession: () => {
        sessionStorage.removeItem('bizresearch_session_id');
        set({
            sessionId: getOrCreateSessionId(),
            steps: [],
            finalAnswer: null,
            status: 'idle',
            fromCache: false,
            pendingPrompt: null,
        });
    },
}));