import { Component, type ErrorInfo } from 'react';
import type { ReactNode } from 'react';
import logger from '@/lib/logger.ts';

// ============================================================
// ErrorBoundary
//
// Catches unhandled React render errors so a single broken
// component cannot white-screen the entire app.
// ============================================================

interface Props {
    children: ReactNode;
    // Optional custom fallback UI. Receives the error so callers
    // can render a contextual message.
    fallback?: (error: Error) => ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        logger.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
    }

    render(): ReactNode {
        const { error } = this.state;

        if (error) {
            if (this.props.fallback) {
                return this.props.fallback(error);
            }

            // Default fallback — intentionally minimal, no external deps
            return (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-destructive font-medium mb-2">
                        Something went wrong
                    </p>
                    <p className="text-muted-foreground text-sm mb-4">
                        {error.message}
                    </p>
                    <button
                        className="text-sm underline text-muted-foreground hover:text-foreground"
                        onClick={() => this.setState({ error: null })}
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}