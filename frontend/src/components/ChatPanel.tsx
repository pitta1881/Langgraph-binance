import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatRequest, ChatResponse, ConversationTurn } from "../../../shared/types/chat.ts";
import type { Kline } from "../../../shared/types/market.ts";

const MAX_HISTORY_TURNS = 10;
import { postJson, getJson } from "../api";
import { extractSymbol } from "../utils/symbols";
import { CandleChart } from "./CandleChart";
import { Select } from "./Select";
import { useAuth } from "../auth/useAuth";

const MODELS = ['gemini-3.1-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] as const;
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

export interface ChatHandle {
  injectText: (text: string) => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  symbol?: string | null;
  intent?: string;
  klines?: Kline[] | null;
}

function buildHistory(messages: Message[]): ConversationTurn[] {
  return messages.slice(-MAX_HISTORY_TURNS).map((m) =>
    m.role === "user"
      ? { role: "user" as const, content: m.content }
      : {
          role: "assistant" as const,
          symbol: m.symbol ?? null,
          intent: m.intent,
        },
  );
}

function getContextColor(ratio: number): string {
  if (ratio > 0.9) return "var(--color-red)";
  if (ratio > 0.7) return "var(--color-warning)";
  return "var(--color-accent)";
}

export const ChatPanel = forwardRef<ChatHandle>(function ChatPanel(_props, ref) {
  const { user, signInWithGoogle } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [sessionId] = useState(() => crypto.randomUUID());
  const [model, setModel] = useState<string>(() => localStorage.getItem('preferred_model') || DEFAULT_MODEL);

  useEffect(() => {
    localStorage.setItem('preferred_model', model);
  }, [model]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const appendToInput = useCallback((text: string) => {
    setInput((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${text}` : text;
    });
    inputRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({
    injectText: (text: string) => appendToInput(text),
  }));

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = buildHistory(messages);
      const data = await postJson<ChatResponse, ChatRequest>(
        "/chat",
        { message: text, history, model, session_id: sessionId },
        { signal: controller.signal }
      );

      const symbol = data.symbol ?? extractSymbol(text);
      let klines: Kline[] | null = null;

      if (symbol) {
        try {
          klines = await getJson<Kline[]>(
            `/klines/${symbol}?interval=4h&limit=42`,
            { signal: controller.signal }
          );
        } catch (e) {
          if (e instanceof Error && e.name !== "AbortError") {
            console.warn("Failed to fetch klines:", e);
          }
        }
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: data.response,
        symbol,
        intent: data.intent,
        klines,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Error desconocido";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const suggestionClass =
    "bg-[#14141e] text-[#8080a0] border border-[#22223a] rounded-full px-4 py-2 cursor-pointer text-[0.82rem] transition-[background,color,border-color] duration-200 hover:bg-bg-raised hover:text-[#d0d0e8] hover:border-[#3a3a58] focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-2";

  if (!user) {
    return (
      <div className="flex flex-col h-full bg-bg-chat">
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div className="max-w-sm">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Inicia sesion para chatear</h2>
            <p className="text-sm text-text-muted mb-4">Necesitas una cuenta de Google para conversar con el asistente.</p>
            <button
              onClick={() => void signInWithGoogle()}
              className="bg-accent text-white px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
            >
              Continuar con Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-chat">
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 text-center text-text-muted px-6 py-10">
            <h2 className="text-[1.3rem] font-semibold mb-1.5 text-[#7070a0] tracking-[-0.01em]">
              Crypto Dashboard
            </h2>
            <p className="text-[0.85rem] text-[#50506a] max-w-[340px] leading-relaxed">
              Pregunta sobre cualquier criptomoneda
            </p>
            <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-[480px]">
              <button className={suggestionClass} onClick={() => appendToInput("Cual es el precio de BTC?")}>
                Precio de BTC
              </button>
              <button className={suggestionClass} onClick={() => appendToInput("Hace un analisis de ETH")}>
                Analisis de ETH
              </button>
              <button className={suggestionClass} onClick={() => appendToInput("Como esta el mercado?")}>
                Estado del mercado
              </button>
              <button className={suggestionClass} onClick={() => appendToInput("Que es SOL?")}>
                Que es SOL?
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`chat__bubble max-w-[76%] px-4 py-3 rounded-[14px] text-[0.9rem] leading-relaxed ${
                msg.role === "user"
                  ? "bg-bg-elev-bubble text-[#e0e8f0] rounded-br-sm"
                  : "bg-bg-raised text-[#c8c8dc] rounded-bl-sm border border-border"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {msg.klines && msg.klines.length > 0 && msg.symbol && (
                    <CandleChart
                      data={msg.klines}
                      symbol={msg.symbol}
                      title="7D Chart (4h)"
                    />
                  )}
                </>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="chat__bubble max-w-[76%] px-5 py-3 rounded-[14px] bg-bg-raised rounded-bl-sm border border-border">
              <span className="flex gap-1">
                <span className="animate-blink text-[1.4rem] text-[#50507a]">.</span>
                <span className="animate-blink text-[1.4rem] text-[#50507a]" style={{ animationDelay: "0.2s" }}>.</span>
                <span className="animate-blink text-[1.4rem] text-[#50507a]" style={{ animationDelay: "0.4s" }}>.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-1.5 border-t border-[#1a1a2a] bg-bg-input">
          <div className="flex-1 h-[3px] bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width,background-color] duration-300"
              style={{
                width: `${(Math.min(messages.length, MAX_HISTORY_TURNS) / MAX_HISTORY_TURNS) * 100}%`,
                backgroundColor: getContextColor(Math.min(messages.length, MAX_HISTORY_TURNS) / MAX_HISTORY_TURNS),
              }}
            />
          </div>
          <span className="text-[0.7rem] text-text-muted whitespace-nowrap flex-shrink-0">
            {Math.min(messages.length, MAX_HISTORY_TURNS)}/{MAX_HISTORY_TURNS} contexto
          </span>
          <button
            className="bg-transparent border border-border rounded-sm text-text-muted text-[0.85rem] px-1.5 py-0 cursor-pointer transition-[color,border-color] duration-200 leading-none flex-shrink-0 hover:text-text-primary hover:border-border-soft focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-2"
            onClick={() => setMessages([])}
            aria-label="Nueva conversacion"
            title="Nueva conversacion"
          >
            &#8635;
          </button>
        </div>
      )}

      <div className="flex gap-2 px-4 py-3.5 border-t border-[#1a1a2a] bg-bg-input">
        <textarea
          ref={inputRef}
          className="flex-1 bg-bg-textarea text-text-primary border border-[#22223a] rounded-[10px] px-3.5 py-2.5 text-[0.9rem] resize-none outline-none transition-[border-color] duration-200 placeholder:text-[#40405a] focus:border-[#3d5a80]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pregunta sobre cripto..."
          rows={1}
          disabled={loading}
          aria-label="Escribe un mensaje"
        />
        <button
          className="bg-bg-elev-bubble text-[#c0d8f0] border-0 rounded-[10px] px-[18px] py-2.5 cursor-pointer text-[1.1rem] transition-colors duration-200 flex items-center justify-center flex-shrink-0 enabled:hover:bg-[#2a4f78] focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => void sendMessage()}
          disabled={loading || !input.trim()}
          aria-label="Enviar mensaje"
        >
          {loading ? "⏳" : "➤"}
        </button>
      </div>

      <div className="px-4 py-2 border-t border-border-soft flex items-center gap-3 flex-wrap bg-bg-input">
        <label className="text-xs text-text-muted">Modelo:</label>
        <Select
          value={model as typeof MODELS[number]}
          options={MODELS}
          onChange={(v) => setModel(v)}
          ariaLabel="Modelo de lenguaje"
        />
        <span className="ml-auto text-[11px] text-text-muted text-right">
          Este asistente puede cometer errores. La informacion no constituye asesoramiento financiero.
        </span>
      </div>
    </div>
  );
});
