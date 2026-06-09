import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { Heatmap } from "./components/Heatmap";
import { TrendingPanel } from "./components/TrendingPanel";
import { TickerBanner } from "./components/TickerBanner";
import "./App.css";

export interface ChatHandle {
  injectText: (text: string) => void;
}

export default function App() {
  const chatRef = useRef<ChatHandle>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleCoinClick = (ticker: string) => {
    chatRef.current?.injectText(ticker);
    setDrawerOpen(false);
  };

  // Close drawer on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerOpen) setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="app">
      <h1 className="sr-only">Crypto Intelligence Dashboard</h1>

      <TickerBanner />

      <button
        className="hamburger"
        aria-label="Abrir menú"
        aria-expanded={drawerOpen}
        aria-controls="sidebar"
        onClick={() => setDrawerOpen((o) => !o)}
      >
        ☰
      </button>

      <div
        className={`drawer-backdrop${drawerOpen ? " drawer-backdrop--visible" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <div className="app__layout">
        <aside
          id="sidebar"
          className={`app__sidebar${drawerOpen ? " app__sidebar--open" : ""}`}
        >
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
