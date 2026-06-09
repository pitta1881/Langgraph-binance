import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { CandleChart } from "./CandleChart";
import "./ChatPanel.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const ChatPanel = forwardRef(function ChatPanel(
  { conversationId },
  ref
) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const appendToInput = useCallback((text) => {
    setInput((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${text}` : text;
    });
    inputRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({
    injectText: (text) => appendToInput(text),
    reset: () => {
      setMessages([]);
      setInput("");
    },
  }));

  const extractSymbol = (text) => {
    const symbols = [
      "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
      "ADAUSDT", "DOGEUSDT", "DOTUSDT", "AVAXUSDT", "MATICUSDT",
      "LINKUSDT", "UNIUSDT", "ATOMUSDT", "LTCUSDT", "NEARUSDT",
    ];
    const upper = text.toUpperCase();
    for (const s of symbols) {
      const base = s.replace("USDT", "");
      if (upper.includes(base)) return s;
    }
    return null;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const symbol = extractSymbol(text);
      let klines = null;

      if (symbol) {
        try {
          const klinesRes = await fetch(
            `${API}/klines/${symbol}?interval=4h&limit=42`
          );
          if (klinesRes.ok) {
            klines = await klinesRes.json();
          }
        } catch (e) {
          console.warn("Failed to fetch klines:", e);
        }
      }

      const assistantMsg = {
        role: "assistant",
        content: data.response,
        symbol,
        klines,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat">
      <div className="chat__messages">
        {messages.length === 0 && (
          <div className="chat__empty">
            <h2>🪙 Crypto Dashboard</h2>
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
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {msg.klines && msg.klines.length > 0 && (
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
        />
        <button
          className="chat__send"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          {loading ? "⏳" : "➤"}
        </button>
      </div>
    </div>
  );
});
