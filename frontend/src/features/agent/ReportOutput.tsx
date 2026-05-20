import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore } from '@/store/agentStore';
import { Copy, Check, Cpu } from 'lucide-react';
import { useState, useCallback } from 'react';

// --- Copy button with transient feedback ---

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API unavailable (non-HTTPS or blocked by browser)
            console.error('[ReportOutput] clipboard write failed');
        }
    }, [text]);

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
            {copied ? (
                <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                </>
            ) : (
                <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                </>
            )}
        </Button>
    );
}

// --- Empty state ---

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
            <Cpu className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
                Final report will appear here once the agent completes.
            </p>
        </div>
    );
}

// --- Main component ---

export function ReportOutput() {
    const { finalAnswer, status, activeProvider } = useAgentStore();

    // Don't render anything before the agent has been run at least once
    if (status === 'idle') return null;

    return (
        <div className="rounded-lg border bg-card">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Report</span>
                    {activeProvider && (
                        <Badge variant="outline" className="text-xs font-mono">
                            {activeProvider}
                        </Badge>
                    )}
                </div>
                {finalAnswer && <CopyButton text={finalAnswer} />}
            </div>

            {/* Body */}
            {finalAnswer ? (
                <ScrollArea className="h-[480px]">
                    <div className="px-5 py-4 prose prose-sm prose-neutral dark:prose-invert max-w-none">
                        <ReactMarkdown>{finalAnswer}</ReactMarkdown>
                    </div>
                </ScrollArea>
            ) : (
                <EmptyState />
            )}
        </div>
    );
}