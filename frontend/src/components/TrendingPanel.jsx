import { useEffect, useState } from "react";
import "./TrendingPanel.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function TrendingPanel({ onCoinClick }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch(`${API}/trending`);
        if (res.ok) setItems(await res.json());
      } catch (e) {
        console.warn("Trending fetch failed:", e);
      }
    };
    fetchTrending();
    const interval = setInterval(fetchTrending, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="trending">
      <h3 className="trending__title">📈 Tendencias</h3>
      <ul className="trending__list">
        {items.map((item, i) => (
          <li
            key={item.symbol}
            className="trending__item"
            onClick={() => onCoinClick?.(item.symbol.toUpperCase())}
          >
            <span className="trending__rank">#{i + 1}</span>
            <img
              className="trending__thumb"
              src={item.thumb}
              alt={item.name}
              width={20}
              height={20}
            />
            <div className="trending__info">
              <span className="trending__name">{item.name}</span>
              <span className="trending__symbol">
                {item.symbol.toUpperCase()}
              </span>
            </div>
            {item.market_cap_rank && (
              <span className="trending__mcap">#{item.market_cap_rank}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
