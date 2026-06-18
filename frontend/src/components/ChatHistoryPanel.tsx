import { useMemo } from "react";
import type { ChatSession } from "../../../shared/types/sessions.ts";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../auth/useAuth";
import { PanelTitle } from "./PanelTitle";

interface Props {
  activeSessionId: string | null;
  refreshKey: number;
  onLoadSession: (sessionId: string) => void;
  onNewConversation: () => void;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "ahora";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `hace ${diffDay} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function ChatHistoryPanel({ activeSessionId, refreshKey, onLoadSession, onNewConversation }: Props) {
  const { user } = useAuth();
  const { data, loading, error } = useFetch<ChatSession[]>("/sessions", [refreshKey, user?.id ?? ""]);

  const sessions = useMemo(() => data ?? [], [data]);

  if (!user) return null;

  return (
    <div className="bg-bg-surface rounded-md p-2 flex flex-col h-full overflow-hidden">
      <PanelTitle>💬 Mis conversaciones</PanelTitle>

      <button
        type="button"
        onClick={onNewConversation}
        className="w-full mt-1 mb-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent text-white text-sm font-medium cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-2"
        aria-label="Nueva conversación"
      >
        <span className="text-base leading-none">+</span>
        <span>Nueva conversación</span>
      </button>

      {loading && !data && (
        <p className="text-[0.78rem] text-text-muted text-center py-3">Cargando...</p>
      )}
      {error && !data && (
        <p className="text-[0.78rem] text-text-muted text-center py-3" role="alert">
          Error al cargar conversaciones
        </p>
      )}
      {!loading && sessions.length === 0 && (
        <p className="text-[0.78rem] text-text-muted text-center py-3 px-2 leading-relaxed">
          Todavía no tenés conversaciones guardadas. Mandá un mensaje y va a aparecer acá.
        </p>
      )}

      {sessions.length > 0 && (
        <ul className="list-none flex flex-col gap-1 overflow-y-auto">
          {sessions.map((s) => {
            const isActive = s.session_id === activeSessionId;
            return (
              <li key={s.session_id}>
                <button
                  type="button"
                  onClick={() => onLoadSession(s.session_id)}
                  className={`w-full text-left flex flex-col gap-0.5 px-2 py-2 rounded cursor-pointer transition-colors border ${
                    isActive
                      ? "bg-bg-raised border-border-soft"
                      : "bg-transparent border-transparent hover:bg-bg-raised hover:border-border"
                  } focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-1`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="text-[0.8rem] text-text-primary line-clamp-2 leading-snug">
                    {s.first_message || "(sin mensaje)"}
                  </span>
                  <span className="flex items-center gap-2 text-[0.65rem] text-text-faint">
                    <span>{formatRelative(s.ended_at)}</span>
                    <span>·</span>
                    <span>{s.message_count} turno{s.message_count === 1 ? "" : "s"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
