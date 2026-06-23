import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { ChatPanel } from "./components/ChatPanel";
import type { Message } from "./components/ChatPanel";
import { ChatHistoryPanel } from "./components/ChatHistoryPanel";
import { FavoritesPanel } from "./components/FavoritesPanel";
import { Heatmap } from "./components/Heatmap";
import { TrendingPanel } from "./components/TrendingPanel";
import { TickerBanner } from "./components/TickerBanner";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/useAuth";
import { AdminDashboard } from "./pages/AdminDashboard";
import { deleteJson, getJson } from "./api";
import type { SessionMessage } from "../../shared/types/sessions.ts";

export interface ChatHandle {
  injectText: (text: string) => void;
  loadSession: (sessionId: string, messages: Message[]) => void;
  newConversation: () => string;
}

function HomePage() {
  const chatRef = useRef<ChatHandle>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  const handleCoinClick = (ticker: string) => {
    chatRef.current?.injectText(ticker);
    setDrawerOpen(false);
  };

  const handleSessionChange = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setHistoryRefreshKey((k) => k + 1);
  }, []);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteJson(`/sessions/${sessionId}`);
    setHistoryRefreshKey((k) => k + 1);
    if (sessionId === activeSessionId) {
      chatRef.current?.newConversation();
    }
  }, [activeSessionId]);

  const handleDeleteAll = useCallback(async () => {
    await deleteJson('/sessions');
    setHistoryRefreshKey((k) => k + 1);
    chatRef.current?.newConversation();
  }, []);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    try {
      const rows = await getJson<SessionMessage[]>(`/sessions/${sessionId}`);
      const msgs: Message[] = [];
      for (const r of rows) {
        msgs.push({ role: "user", content: r.message });
        if (r.response) {
          msgs.push({
            role: "assistant",
            content: r.response,
            symbol: r.symbol,
            intent: r.intent ?? undefined,
            klines: null,
          });
        }
      }
      chatRef.current?.loadSession(sessionId, msgs);
      setActiveSessionId(sessionId);
      setHistoryDrawerOpen(false);
    } catch (err) {
      console.warn("Failed to load session", sessionId, err);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (drawerOpen) setDrawerOpen(false);
        if (historyDrawerOpen) setHistoryDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, historyDrawerOpen]);

  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const isAdmin = user != null && adminEmails.includes(user.email);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <h1 className="sr-only">Crypto Intelligence Dashboard</h1>

      <TickerBanner />

      <div className="hidden max-md:flex fixed top-[46px] left-0 right-0 z-[201] px-2 py-1 bg-bg-base border-b border-border items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            className="flex bg-bg-raised border border-border rounded-sm text-text-secondary w-[34px] h-[34px] cursor-pointer text-lg items-center justify-center transition-colors hover:bg-bg-surface focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-2"
            aria-label="Abrir menu de mercados"
            aria-expanded={drawerOpen}
            aria-controls="sidebar"
            onClick={() => setDrawerOpen((o) => !o)}
          >
            &#9776;
          </button>
          {user && (
            <button
              className="flex bg-bg-raised border border-border rounded-sm text-text-secondary w-[34px] h-[34px] cursor-pointer text-[1rem] items-center justify-center transition-colors hover:bg-bg-surface focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-2"
              aria-label="Abrir historial de conversaciones"
              aria-expanded={historyDrawerOpen}
              aria-controls="history-sidebar"
              onClick={() => setHistoryDrawerOpen((o) => !o)}
              title="Mis conversaciones"
            >
              🕘
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!loading && !user && (
            <button
              onClick={() => void signInWithGoogle()}
              className="bg-accent hover:opacity-90 text-white px-3 py-1.5 rounded-md text-sm transition-opacity"
            >
              Iniciar sesion con Google
            </button>
          )}
          {!loading && user && (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-1"
                >
                  Admin
                </Link>
              )}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-bg-raised border border-border-soft flex items-center justify-center text-xs text-text-secondary font-medium flex-shrink-0">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-text-muted max-w-[120px] truncate hidden sm:block">
                  {user.email}
                </span>
                <button
                  onClick={() => void signOut()}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-1"
                >
                  Salir
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className={`hidden fixed inset-0 bg-black/55 z-[299] backdrop-blur-sm${(drawerOpen || historyDrawerOpen) ? " !block" : ""}`}
        onClick={() => {
          setDrawerOpen(false);
          setHistoryDrawerOpen(false);
        }}
        aria-hidden="true"
      />

      <div className="flex flex-1 overflow-hidden max-md:mt-[42px]">
        <aside
          id="sidebar"
          className={`w-[300px] min-w-[260px] flex flex-col gap-1.5 p-2.5 overflow-y-auto border-r border-border bg-bg-base max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[280px] max-md:z-[300] max-md:-translate-x-full max-md:transition-transform max-md:duration-[250ms]${drawerOpen ? " max-md:translate-x-0" : ""}`}
        >
          <FavoritesPanel onCoinClick={handleCoinClick} />
          <Heatmap onCoinClick={handleCoinClick} />
          <TrendingPanel onCoinClick={handleCoinClick} />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="hidden md:flex items-center justify-end gap-2 px-4 py-2 border-b border-border bg-bg-base">
            {!loading && !user && (
              <button
                onClick={() => void signInWithGoogle()}
                className="bg-accent hover:opacity-90 text-white px-3 py-1.5 rounded-md text-sm transition-opacity"
              >
                Iniciar sesion con Google
              </button>
            )}
            {!loading && user && (
              <>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-1"
                  >
                    Admin
                  </Link>
                )}
                <div className="w-7 h-7 rounded-full bg-bg-raised border border-border-soft flex items-center justify-center text-xs text-text-secondary font-medium flex-shrink-0">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-text-muted max-w-[200px] truncate">
                  {user.email}
                </span>
                <button
                  onClick={() => void signOut()}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-1 border border-border rounded-sm"
                >
                  Salir
                </button>
              </>
            )}
          </div>
          <ChatPanel ref={chatRef} onSessionChange={handleSessionChange} />
        </main>

        {user && (
          <aside
            id="history-sidebar"
            className={`w-[280px] min-w-[240px] flex flex-col gap-1.5 p-2.5 overflow-hidden border-l border-border bg-bg-base max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:w-[280px] max-md:z-[300] max-md:translate-x-full max-md:transition-transform max-md:duration-[250ms]${historyDrawerOpen ? " max-md:translate-x-0" : ""}`}
          >
            <ChatHistoryPanel
              activeSessionId={activeSessionId}
              refreshKey={historyRefreshKey}
              onLoadSession={handleLoadSession}
              onNewConversation={() => {
                chatRef.current?.newConversation();
                setHistoryDrawerOpen(false);
              }}
              onDeleteSession={handleDeleteSession}
              onDeleteAll={handleDeleteAll}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
