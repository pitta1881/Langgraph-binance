import { useRef } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { Heatmap } from "./components/Heatmap";
import { TrendingPanel } from "./components/TrendingPanel";
import { TickerBanner } from "./components/TickerBanner";
import { ConversationHistory } from "./components/ConversationHistory";
import "./App.css";

export default function App() {
  const chatRef = useRef(null);

  const handleCoinClick = (ticker) => {
    chatRef.current?.injectText(ticker);
  };

  const handleNewConversation = () => {
    chatRef.current?.reset();
  };

  return (
    <div className="app">
      <TickerBanner />
      <div className="app__layout">
        <aside className="app__sidebar">
          <ConversationHistory onNewConversation={handleNewConversation} />
          <Heatmap onCoinClick={handleCoinClick} />
          <TrendingPanel onCoinClick={handleCoinClick} />
        </aside>
        <main className="app__main">
          <ChatPanel ref={chatRef} />
        </main>
      </div>
    </div>
  );
}
