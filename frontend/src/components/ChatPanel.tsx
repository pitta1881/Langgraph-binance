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

const MAX_HISTORY_TURNS = 20;
import { postJson, getJson } from "../api";
import { extractSymbol } from "../utils/symbols";
import { CandleChart } from "./CandleChart";
import "./ChatPanel.css";

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

/**
 * Build the compact conversation history the gateway forwards to the agent.
 *
 * For user messages we send the raw text. For assistant messages we send
 * ONLY the resolved symbol + intent — the reviewer text would just bloat
 * the prompt without giving the intent_router useful signal.
 */
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

export const ChatPanel = forwardRef<ChatHandle>(function ChatPanel(_props, ref) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Abort in-flight requests on unmount
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

    // Abort any previous in-flight request
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
        { message: text, history },
        { signal: controller.signal }
      );

      // Prefer the symbol the agent actually resolved (it may carry over from
      // history); fall back to the local pattern matcher for older responses.
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

  return (
    <div className="chat">
      <div className="chat__messages">
        {messages.length === 0 && (
          <div className="chat__empty">
            <h2>Crypto Dashboard</h2>
            <p>Preguntá sobre cualquier criptomoneda</p>
            <div className="chat__suggestions">
              <button onClick={() => appendToInput("¿Cuál es el precio de BTC?")}>
                Precio de BTC
              </button>
              <button onClick={() => appendToInput("Hacé un análisis de ETH")}>
                Análisis de ETH
              </button>
              <button onClick={() => appendToInput("¿Cómo está el mercado?")}>
                Estado del mercado
              </button>
              <button onClick={() => appendToInput("¿Qué es SOL?")}>
                ¿Qué es SOL?
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat__message chat__message--${msg.role}`}>
            <div className="chat__bubble">
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
          <div className="chat__message chat__message--assistant">
            <div className="chat__bubble chat__bubble--loading">
              <span className="chat__dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat__input-area">
        <textarea
          ref={inputRef}
          className="chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Preguntá sobre cripto..."
          rows={1}
          disabled={loading}
          aria-label="Escribí un mensaje"
        />
        <button
          className="chat__send"
          onClick={() => void sendMessage()}
          disabled={loading || !input.trim()}
          aria-label="Enviar mensaje"
        >
          {loading ? "⏳" : "➤"}
        </button>
      </div>
    </div>
  );
});
