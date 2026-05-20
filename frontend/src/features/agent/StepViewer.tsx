import { useRef, useEffect } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore } from '@/store/agentStore.ts';
import type { AgentStep } from '../../store/agentStore';
import {Brain, Wrench, FileText, ChevronDown, CheckCircle} from 'lucide-react';

// --- Step type config ---

interface StepConfig {
    label: string;
    icon: React.ReactNode;
    badgeVariant: 'default' | 'secondary' | 'outline';
}

function getStepConfig(type: AgentStep['type']): StepConfig {
    switch (type) {
        case 'thinking':
            return {
                label: 'Thinking',
                icon: <Brain className="w-4 h-4" />,
                badgeVariant: 'secondary',
            };
        case 'tool_call':
            return {
                label: 'Tool Call',
                icon: <Wrench className="w-4 h-4" />,
                badgeVariant: 'default',
            };
        case 'tool_result':
            return {
                label: 'Tool Result',
                icon: <FileText className="w-4 h-4" />,
                badgeVariant: 'outline',
            };
        case 'final_answer':
            return {
                label: 'Final Answer',
                icon: <CheckCircle className="w-4 h-4" />,
                badgeVariant: 'default',
            };
        default:
            return {
                label: type ?? 'Unknown',
                icon: <Brain className="w-4 h-4" />,
                badgeVariant: 'secondary',
            };
    }
}

// --- Individual step card ---

function StepCard({ step, index }: { step: AgentStep; index: number }) {
    const config = getStepConfig(step.type);
    const isCollapsible = step.type === 'tool_result' && !!step.result;

    const header = (
        <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{config.icon}</span>
            <Badge variant={config.badgeVariant} className="text-xs">
        {config.label}
        </Badge>
    {step.toolName && (
        <span className="text-xs font-mono text-muted-foreground">
            {step.toolName}
            </span>
    )}
    <span className="text-xs text-muted-foreground ml-auto">#{index + 1}</span>
    </div>
);

    // Thinking step — plain message
    if (step.type === 'thinking') {
        return (
            <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
                {header}
        {step.message && (
            <p className="text-sm text-foreground leading-relaxed pl-1">
                {step.message}
                </p>
        )}
        </div>
    );
    }

    // Tool call — show args as JSON
    if (step.type === 'tool_call') {
        return (
            <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
                {header}
        {step.args && (
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto text-muted-foreground">
                {JSON.stringify(step.args, null, 2)}
                </pre>
        )}
        </div>
    );
    }

    // Tool result — collapsible because content can be long
    if (isCollapsible) {
        return (
            <Collapsible>
                <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
                {header}
                <CollapsibleTrigger className="ml-2 p-1 rounded hover:bg-muted transition-colors">
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
        <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap">
            {step.result}
            </pre>
            </CollapsibleContent>
            </div>
            </Collapsible>
    );
    }

    return null;
}

// --- Skeleton loader ---

function StepSkeleton() {
    return (
        <div className="rounded-lg border bg-card px-4 py-3 space-y-2 animate-pulse">
        <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-muted" />
        <div className="w-16 h-5 rounded bg-muted" />
            </div>
            <div className="w-3/4 h-3 rounded bg-muted" />
        </div>
);
}

// --- Main component ---

export function StepViewer() {
    const { steps, status } = useAgentStore();
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to latest step
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [steps.length]);

    if (status === 'idle') return null;

    return (
        <ScrollArea className="h-[420px] w-full rounded-lg border bg-background">
        <div className="flex flex-col gap-3 p-4">
            {steps.map((step, i) => (
                    <StepCard key={i} step={step} index={i} />
))}

    {/* Skeleton shown while running and waiting for next step */}
    {status === 'running' && <StepSkeleton />}

    {/* Anchor for auto-scroll */}
    <div ref={bottomRef} />
    </div>
    </ScrollArea>
);
}