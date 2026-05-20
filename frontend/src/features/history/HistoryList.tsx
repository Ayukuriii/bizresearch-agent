import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ApiResponse } from '@/lib/api';
import { useAgentStore } from '@/store/agentStore';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Clock, CheckCircle2, XCircle, Activity } from 'lucide-react';

// --- Types matching backend response ---

interface TaskStep {
    id: string;
    stepType: 'thinking' | 'tool_call' | 'tool_result';
    content: string;
    createdAt: string;
}

interface Task {
    id: string;
    sessionId: string;
    userMessage: string;
    finalAnswer: string | null;
    status: 'running' | 'done' | 'error';
    createdAt: string;
    steps: TaskStep[];
}

interface HistoryData {
    sessionId: string;
    total: number;
    tasks: Task[];
}

// --- Status badge ---

function StatusBadge({ status }: { status: Task['status'] }) {
    switch (status) {
        case 'running':
            return (
                <Badge variant="secondary" className="gap-1 text-xs">
                    <Activity className="w-3 h-3" />
                    Running
                </Badge>
            );
        case 'done':
            return (
                <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-300">
                    <CheckCircle2 className="w-3 h-3" />
                    Done
                </Badge>
            );
        case 'error':
            return (
                <Badge variant="outline" className="gap-1 text-xs text-destructive border-destructive/30">
                    <XCircle className="w-3 h-3" />
                    Error
                </Badge>
            );
    }
}

// --- Individual task row ---

function TaskRow({ task }: { task: Task }) {
    const date = new Date(task.createdAt);
    const timeLabel = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
    const dateLabel = date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors">
            {/* Top row: message + status */}
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">
                    {task.userMessage}
                </p>
                <StatusBadge status={task.status} />
            </div>

            {/* Answer preview */}
            {task.finalAnswer && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {task.finalAnswer}
                </p>
            )}

            {/* Bottom row: steps count + timestamp */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
            {dateLabel} · {timeLabel}
        </span>
                <span>{task.steps.length} steps</span>
            </div>
        </div>
    );
}

// --- Empty state ---

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
            <Clock className="w-7 h-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
                No tasks yet for this session.
            </p>
        </div>
    );
}

// --- Main component ---

export function HistoryList() {
    const { sessionId, status } = useAgentStore();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['history', sessionId],
        queryFn: async () => {
            const res = await apiClient.get<ApiResponse<HistoryData>>(
                `/history/${sessionId}`
            );
            if (!res.data.success) {
                throw new Error(res.data.error.message);
            }
            return res.data.data.tasks;
        },
        // Refetch when agent finishes a run
        enabled: !!sessionId,
        refetchInterval: status === 'running' ? 5_000 : false,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading history...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center h-40">
                <p className="text-sm text-destructive">
                    Failed to load history. Is the backend running?
                </p>
            </div>
        );
    }

    const tasks = data ?? [];

    return (
        <div className="w-full max-w-4xl mx-auto px-4">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-foreground">Session History</h2>
                <span className="text-xs text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
            </div>

            {tasks.length === 0 ? (
                <EmptyState />
            ) : (
                <ScrollArea className="h-90">
                    <div className="flex flex-col gap-3 pr-3">
                        {tasks.map((task) => (
                            <TaskRow key={task.id} task={task} />
                        ))}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}