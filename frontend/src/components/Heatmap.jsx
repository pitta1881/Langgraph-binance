import { useEffect, useState } from "react";
import "./Heatmap.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function Heatmap({ onCoinClick }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await fetch(`${API}/heatmap`);
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.warn("Heatmap fetch failed:", e);
      }
    };
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 30000);
    return () => clearInterval(interval);
  }, []);

  const getColor = (changePct) => {
    if (changePct > 5) return "#00c853";
    if (changePct > 2) return "#1b8a3d";
    if (changePct > 0) return "#1a3a2a";
    if (changePct > -2) return "#3a1a1a";
    if (changePct > -5) return "#8a1b1b";
    return "#ff1744";
  };

  return (
    <div className="heatmap">
      <h3 className="heatmap__title">🔥 Volumen 24h</h3>
      <div className="heatmap__grid">
        {data.map((item) => {
          const ticker = item.symbol.replace("USDT", "");
          return (
            <div
              key={item.symbol}
              className="heatmap__cell"
              style={{ backgroundColor: getColor(item.change_pct) }}
              onClick={() => onCoinClick?.(ticker)}
              title={`${ticker}: $${item.price.toLocaleString()} (${item.change_pct > 0 ? "+" : ""}${item.change_pct.toFixed(2)}%)`}
            >
              <span className="heatmap__symbol">{ticker}</span>
              <span className="heatmap__change">
                {item.change_pct > 0 ? "+" : ""}
                {item.change_pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
