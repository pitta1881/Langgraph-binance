import { useEffect, useState } from 'react';
import { getJson } from '../api';
import { useAuth } from '../auth/useAuth';

interface SessionRow {
  session_id: string;
  user_email: string;
  started_at: string;
  message_count: number;
}

interface ChatRow {
  id: string;
  message: string;
  intent: string | null;
  symbol: string | null;
  model: string;
  response: string | null;
}

interface TraceRow {
  id: string;
  node_name: string;
  model: string;
  latency_ms: number | null;
  error: string | null;
  prompt_system: string | null;
  prompt_user: string | null;
  response: string | null;
}

type ViewState =
  | { view: 'sessions' }
  | { view: 'chats'; sessionId: string }
  | { view: 'traces'; sessionId: string; chatId: string };

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [viewState, setViewState] = useState<ViewState>({ view: 'sessions' });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (viewState.view !== 'sessions') return;
    setLoading(true);
    setError(null);
    getJson<SessionRow[]>('/admin/sessions')
      .then(setSessions)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [viewState.view]);

  useEffect(() => {
    if (viewState.view !== 'chats') return;
    setLoading(true);
    setError(null);
    getJson<ChatRow[]>(`/admin/sessions/${viewState.sessionId}/chats`)
      .then(setChats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [viewState]);

  useEffect(() => {
    if (viewState.view !== 'traces') return;
    setLoading(true);
    setError(null);
    getJson<TraceRow[]>(`/admin/chats/${viewState.chatId}/traces`)
      .then(setTraces)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [viewState]);

  return (
    <div className="min-h-screen bg-bg-base p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-text-primary">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">{user?.email}</span>
            <button
              onClick={() => void signOut()}
              className="text-xs bg-bg-raised border border-border-soft text-text-muted px-3 py-1.5 rounded-md hover:text-text-primary transition-colors"
            >
              Salir
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-bg-raised border border-border-soft text-text-muted text-sm px-4 py-3 rounded-md mb-4">
            Error: {error}
          </div>
        )}

        {loading && (
          <div className="text-text-muted text-sm mb-4">Cargando...</div>
        )}

        {viewState.view === 'sessions' && !loading && (
          <div>
            <h2 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wider">Sesiones</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border">
                    <th className="py-2 pr-4 font-medium">Session ID</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Iniciada</th>
                    <th className="py-2 font-medium">Mensajes</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-text-muted text-center">Sin sesiones registradas</td>
                    </tr>
                  )}
                  {sessions.map((s) => (
                    <tr
                      key={s.session_id}
                      className="border-b border-border hover:bg-bg-raised cursor-pointer transition-colors"
                      onClick={() => setViewState({ view: 'chats', sessionId: s.session_id })}
                    >
                      <td className="py-2.5 pr-4 text-text-primary font-mono text-xs">
                        {s.session_id.slice(0, 8)}...
                      </td>
                      <td className="py-2.5 pr-4 text-text-secondary">{s.user_email}</td>
                      <td className="py-2.5 pr-4 text-text-muted">
                        {new Date(s.started_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-text-secondary">{s.message_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewState.view === 'chats' && !loading && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setViewState({ view: 'sessions' })}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                &larr; Sesiones
              </button>
              <span className="text-text-muted text-xs">/</span>
              <span className="text-text-muted text-xs font-mono">{viewState.sessionId.slice(0, 8)}...</span>
            </div>
            <h2 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wider">Chats</h2>
            <div className="flex flex-col gap-3">
              {chats.length === 0 && (
                <div className="text-text-muted text-sm text-center py-4">Sin chats en esta sesion</div>
              )}
              {chats.map((c) => (
                <div
                  key={c.id}
                  className="bg-bg-raised border border-border rounded-md px-4 py-3 cursor-pointer hover:border-border-soft transition-colors"
                  onClick={() => setViewState({ view: 'traces', sessionId: viewState.sessionId, chatId: c.id })}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {c.intent && (
                      <span className="text-xs text-text-muted bg-bg-base border border-border px-1.5 py-0.5 rounded">
                        {c.intent}
                      </span>
                    )}
                    {c.symbol && (
                      <span className="text-xs text-text-muted bg-bg-base border border-border px-1.5 py-0.5 rounded">
                        {c.symbol}
                      </span>
                    )}
                    <span className="text-xs text-text-muted ml-auto">{c.model}</span>
                  </div>
                  <p className="text-sm text-text-primary mb-1">{c.message}</p>
                  {c.response && (
                    <p className="text-xs text-text-muted line-clamp-2">
                      {c.response.slice(0, 200)}{c.response.length > 200 ? '...' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {viewState.view === 'traces' && !loading && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setViewState({ view: 'sessions' })}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                &larr; Sesiones
              </button>
              <span className="text-text-muted text-xs">/</span>
              <button
                onClick={() => setViewState({ view: 'chats', sessionId: viewState.sessionId })}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Chats
              </button>
              <span className="text-text-muted text-xs">/</span>
              <span className="text-text-muted text-xs font-mono">{viewState.chatId.slice(0, 8)}...</span>
            </div>
            <h2 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wider">Trazas de nodos</h2>
            <div className="flex flex-col gap-2">
              {traces.length === 0 && (
                <div className="text-text-muted text-sm text-center py-4">Sin trazas registradas</div>
              )}
              {traces.map((t) => (
                <details
                  key={t.id}
                  className="bg-bg-raised border border-border rounded-md overflow-hidden"
                >
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none hover:bg-bg-surface transition-colors">
                    <span className="text-sm font-medium text-text-primary">{t.node_name}</span>
                    <span className="text-xs text-text-muted">{t.model}</span>
                    {t.latency_ms != null && (
                      <span className="text-xs text-text-muted ml-auto">{t.latency_ms} ms</span>
                    )}
                    {t.error && (
                      <span className="text-xs text-red-500 bg-red-950/30 border border-red-900/50 px-1.5 py-0.5 rounded ml-2">
                        error
                      </span>
                    )}
                  </summary>
                  <div className="px-4 pb-4 border-t border-border flex flex-col gap-3 pt-3">
                    {t.prompt_system && (
                      <div>
                        <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">System prompt</p>
                        <pre className="whitespace-pre-wrap text-xs text-text-secondary bg-bg-base border border-border rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
                          {t.prompt_system}
                        </pre>
                      </div>
                    )}
                    {t.prompt_user && (
                      <div>
                        <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">User prompt</p>
                        <pre className="whitespace-pre-wrap text-xs text-text-secondary bg-bg-base border border-border rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
                          {t.prompt_user}
                        </pre>
                      </div>
                    )}
                    {t.response && (
                      <div>
                        <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">Response</p>
                        <pre className="whitespace-pre-wrap text-xs text-text-secondary bg-bg-base border border-border rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
                          {t.response}
                        </pre>
                      </div>
                    )}
                    {t.error && (
                      <div>
                        <p className="text-xs text-red-400 mb-1 uppercase tracking-wider">Error</p>
                        <pre className="whitespace-pre-wrap text-xs text-red-300 bg-bg-base border border-red-900/50 rounded p-3">
                          {t.error}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
