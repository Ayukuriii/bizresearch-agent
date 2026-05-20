import { AgentChat } from './features/agent/AgentChat.tsx';
import { DemoSidebar } from './features/agent/DemoSidebar.tsx';
import { HistoryList } from './features/history/HistoryList.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { useAgentStore } from './store/agentStore.ts';

export default function App() {
    const { status, setPendingPrompt } = useAgentStore();
    const isRunning = status === 'running';

    return (
        <main className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Main chat area */}
                    <div className="flex-1 min-w-0">
                        <ErrorBoundary>
                            <AgentChat />
                        </ErrorBoundary>
                        <div className="mt-6">
                            <HistoryList />
                        </div>
                    </div>

                    {/* Demo sidebar */}
                    <div className="w-full lg:w-72 shrink-0">
                        <DemoSidebar
                            onSelect={setPendingPrompt}
                            disabled={isRunning}
                        />
                    </div>

                </div>
            </div>
        </main>
    );
}