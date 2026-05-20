import {AgentChat} from "./features/agent/AgentChat.tsx";
import {HistoryList} from "./features/history/HistoryList.tsx";

export default function App() {
  return (
      <main className="min-h-screen bg-background">
        <AgentChat />
        <HistoryList />
      </main>
  );
}
