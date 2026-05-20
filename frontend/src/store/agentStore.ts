import { create } from 'zustand';
import type { SSEStepPayload } from '../lib/sseClient';

// Re-export supaya komponen tidak perlu import dari sseClient langsung
export type { SSEStepPayload as AgentStep };

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentState {
    // — State —
    sessionId: string;
    steps: SSEStepPayload[];
    finalAnswer: string | null;
    status: AgentStatus;
    activeProvider: string | null;

    // — Actions —
    addStep: (step: SSEStepPayload) => void;
    setFinalAnswer: (answer: string) => void;
    setStatus: (status: AgentStatus) => void;
    setProvider: (provider: string) => void;
    resetSession: () => void;
}

// sessionId di-generate sekali dan di-persist ke sessionStorage.
// Kalau user refresh halaman dalam sesi yang sama, sessionId tetap sama
// sehingga history Redis masih bisa diambil.
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

    // — Actions —
    addStep: (step) =>
        set((state) => ({ steps: [...state.steps, step] })),

    setFinalAnswer: (answer) =>
        set({ finalAnswer: answer }),

    setStatus: (status) =>
        set({ status }),

    setProvider: (provider) =>
        set({ activeProvider: provider }),

    resetSession: () => {
        // Hapus sessionId lama, generate yang baru
        sessionStorage.removeItem('bizresearch_session_id');
        set({
            sessionId: getOrCreateSessionId(),
            steps: [],
            finalAnswer: null,
            status: 'idle',
        });
    },
}));