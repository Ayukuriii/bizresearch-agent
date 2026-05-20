import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DEMO_SCENARIOS } from '@/demo/scenarios';
import type { DemoScenario } from '@/demo/scenarios';
import { Sparkles, Clock, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DemoSidebarProps {
    onSelect: (prompt: string) => void;
    disabled: boolean;
}

// ─── Scenario card ────────────────────────────────────────────────────────────

interface ScenarioCardProps {
    scenario: DemoScenario;
    onSelect: (prompt: string) => void;
    disabled: boolean;
}

function ScenarioCard({ scenario, onSelect, disabled }: ScenarioCardProps) {
    return (
        <button
            onClick={() => onSelect(scenario.prompt)}
            disabled={disabled}
            className="w-full text-left rounded-lg border bg-card px-3 py-3 space-y-2
                transition-colors duration-150
                hover:bg-accent hover:border-accent-foreground/20
                disabled:opacity-50 disabled:cursor-not-allowed
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                group"
        >
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug group-hover:text-accent-foreground">
                    {scenario.title}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5
                    transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground leading-relaxed">
                {scenario.description}
            </p>

            {/* Footer — tags + estimated iterations */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex flex-wrap gap-1">
                    {scenario.tags.map((tag) => (
                        <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-mono"
                        >
                            {tag}
                        </Badge>
                    ))}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                        {scenario.estimatedIterations}
                    </span>
                </div>
            </div>
        </button>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DemoSidebar({ onSelect, disabled }: DemoSidebarProps) {
    return (
        <aside className="flex flex-col gap-3 w-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-1">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Demo Scenarios</span>
            </div>

            <p className="text-xs text-muted-foreground px-1 leading-relaxed">
                Select a scenario to pre-fill the input. Each is designed to exercise
                multiple agent tools.
            </p>

            {/* Scenario list */}
            <ScrollArea className="h-full">
                <div className="flex flex-col gap-2 pr-1">
                    {DEMO_SCENARIOS.map((scenario) => (
                        <ScenarioCard
                            key={scenario.id}
                            scenario={scenario}
                            onSelect={onSelect}
                            disabled={disabled}
                        />
                    ))}
                </div>
            </ScrollArea>
        </aside>
    );
}