import { useEffect, useState } from "react";
import "./TickerBanner.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatPrice(price) {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (price >= 0.01) return price.toFixed(4);
  return price.toPrecision(4);
}

export function TickerBanner() {
  const [tickers, setTickers] = useState([]);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await fetch(`${API}/ticker/banner`);
        if (res.ok) setTickers(await res.json());
      } catch (e) {
        console.warn("Ticker banner fetch failed:", e);
      }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 15000);
    return () => clearInterval(interval);
  }, []);

  const items = [...tickers, ...tickers];

  return (
    <div className="ticker-banner">
      <div className="ticker-banner__track">
        {items.map((t, i) => (
          <span key={i} className="ticker-banner__item">
            <span className="ticker-banner__symbol">
              {t.symbol.replace("USDT", "")}
            </span>
            <span className="ticker-banner__price">
              ${formatPrice(t.price)}
            </span>
            <span
              className={`ticker-banner__change ${
                t.change_pct >= 0
                  ? "ticker-banner__change--up"
                  : "ticker-banner__change--down"
              }`}
            >
              {t.change_pct >= 0 ? "+" : ""}
              {t.change_pct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
