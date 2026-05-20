import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAgentStore } from '@/store/agentStore';
import { useAgentRun } from './useAgentRun';
import { StepViewer } from './StepViewer';
import { ReportOutput } from './ReportOutput';
import { apiClient } from '@/lib/api';
import type { ApiResponse } from '@/lib/api';
import { Send, Square, RotateCcw, Loader2, Cpu } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthData {
    provider: string;
    model: string;
    status: string;
}

// ─── Textarea with auto-resize ────────────────────────────────────────────────

interface MessageInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    disabled: boolean;
}

function MessageInput({ value, onChange, onSubmit, disabled }: MessageInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (value.trim()) onSubmit();
            }
        },
        [value, onSubmit]
    );

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask the agent to research something... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-foreground
                placeholder:text-muted-foreground focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
                min-h-[40px] max-h-[200px] overflow-y-auto leading-relaxed py-2"
        />
    );
}

// ─── Provider badge ───────────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: string }) {
    return (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b">
            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Provider</span>
            <Badge variant="outline" className="text-xs font-mono ml-1">
                {provider}
            </Badge>
        </div>
    );
}

// ─── Connecting indicator ─────────────────────────────────────────────────────

function ConnectingIndicator() {
    return (
        <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>Connecting to agent...</span>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentChat() {
    const [message, setMessage] = useState('');

    const {
        status,
        steps,
        activeProvider,
        pendingPrompt,
        setProvider,
        setPendingPrompt,
        resetSession,
    } = useAgentStore();

    const { run, cancel } = useAgentRun();

    const isRunning = status === 'running';
    const isConnecting = isRunning && steps.length === 0;

    // Fetch active provider from /api/health on mount
    useEffect(() => {
        apiClient
            .get<ApiResponse<HealthData>>('/health')
            .then((res) => {
                if (res.data.success) {
                    setProvider(res.data.data.provider);
                }
            })
            .catch(() => {
                // Health check failure is non-critical — silently ignore
            });
    }, [setProvider]);

    // Consume prompt injected by DemoSidebar via store
    useEffect(() => {
        if (pendingPrompt !== null) {
            setMessage(pendingPrompt);
            setPendingPrompt(null);
        }
    }, [pendingPrompt, setPendingPrompt]);

    const handleSubmit = useCallback(() => {
        const trimmed = message.trim();
        if (!trimmed || isRunning) return;
        setMessage('');
        run(trimmed);
    }, [message, isRunning, run]);

    const handleReset = useCallback(() => {
        cancel();
        resetSession();
        setMessage('');
    }, [cancel, resetSession]);

    return (
        <div className="flex flex-col gap-6 w-full">

            {/* Input card */}
            <div className="rounded-xl border bg-card shadow-sm">

                {/* Provider badge */}
                {activeProvider && <ProviderBadge provider={activeProvider} />}

                <div className="px-4 pt-3 pb-2">
                    <MessageInput
                        value={message}
                        onChange={setMessage}
                        onSubmit={handleSubmit}
                        disabled={isRunning}
                    />
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between px-3 pb-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        New session
                    </Button>

                    <div className="flex items-center gap-2">
                        {isRunning && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancel}
                                className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                            >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                Stop
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={isRunning || !message.trim()}
                            className="h-8 gap-1.5 text-xs"
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    Run
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Connecting indicator */}
            {isConnecting && <ConnectingIndicator />}

            {/* Agent steps */}
            <StepViewer />

            {/* Final report */}
            <ReportOutput />
        </div>
    );
}