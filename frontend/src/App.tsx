import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { Heatmap } from "./components/Heatmap";
import { TrendingPanel } from "./components/TrendingPanel";
import { TickerBanner } from "./components/TickerBanner";

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerOpen) setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <h1 className="sr-only">Crypto Intelligence Dashboard</h1>

      <TickerBanner />

      <button
        className="hidden max-md:flex fixed top-[46px] left-2 z-[200] bg-bg-raised border border-border rounded-sm text-text-secondary w-[34px] h-[34px] cursor-pointer text-lg items-center justify-center transition-colors hover:bg-bg-surface focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-2"
        aria-label="Abrir menú"
        aria-expanded={drawerOpen}
        aria-controls="sidebar"
        onClick={() => setDrawerOpen((o) => !o)}
      >
        ☰
      </button>

      <div
        className={`hidden fixed inset-0 bg-black/55 z-[299] backdrop-blur-sm${drawerOpen ? " !block" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <div className="flex flex-1 overflow-hidden">
        <aside
          id="sidebar"
          className={`w-[300px] min-w-[260px] flex flex-col gap-1.5 p-2.5 overflow-y-auto border-r border-border bg-bg-base max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[280px] max-md:z-[300] max-md:-translate-x-full max-md:transition-transform max-md:duration-[250ms]${drawerOpen ? " max-md:translate-x-0" : ""}`}
        >
          <Heatmap onCoinClick={handleCoinClick} />
          <TrendingPanel onCoinClick={handleCoinClick} />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatPanel ref={chatRef} />
        </main>
      </div>
    </div>
  );
}
