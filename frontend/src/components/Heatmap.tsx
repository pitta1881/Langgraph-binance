import type { KeyboardEvent } from "react";
import type { Ticker } from "../../../shared/types/market.ts";
import { usePolling } from "../hooks/usePolling";
import { PanelTitle } from "./PanelTitle";
import "./Heatmap.css";

// Named thresholds for heatmap coloring
const THRESHOLD_STRONG = 5;
const THRESHOLD_MID = 2;
const THRESHOLD_ZERO = 0;
const THRESHOLD_MID_NEG = -2;
const THRESHOLD_STRONG_NEG = -5;

function getColorVar(changePct: number): string {
  if (changePct > THRESHOLD_STRONG) return "var(--heatmap-green-strong)";
  if (changePct > THRESHOLD_MID) return "var(--heatmap-green-mid)";
  if (changePct > THRESHOLD_ZERO) return "var(--heatmap-green-weak)";
  if (changePct > THRESHOLD_MID_NEG) return "var(--heatmap-red-weak)";
  if (changePct > THRESHOLD_STRONG_NEG) return "var(--heatmap-red-mid)";
  return "var(--heatmap-red-strong)";
}

interface Props {
  onCoinClick?: (ticker: string) => void;
}

export function Heatmap({ onCoinClick }: Props) {
  const { data, loading, error } = usePolling<Ticker[]>("/heatmap", 30_000);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, ticker: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onCoinClick?.(ticker);
    }
  };

  return (
    <div className="heatmap panel-shell">
      <PanelTitle>🔥 Volumen 24h</PanelTitle>

      {loading && !data && (
        <p className="heatmap__status">Cargando...</p>
      )}
      {error && !data && (
        <p className="heatmap__status" role="alert">
          Error al cargar datos
        </p>
      )}

      {data && (
        <div className="heatmap__grid">
          {data.map((item) => {
            const ticker = item.symbol.replace("USDT", "");
            return (
              <button
                key={item.symbol}
                className="heatmap__cell"
                style={{ backgroundColor: getColorVar(item.change_pct) }}
                onClick={() => onCoinClick?.(ticker)}
                onKeyDown={(e) => handleKeyDown(e, ticker)}
                aria-label={`Analizar ${ticker}`}
                title={`${ticker}: $${item.price.toLocaleString()} (${item.change_pct > 0 ? "+" : ""}${item.change_pct.toFixed(2)}%)`}
              >
                <span className="heatmap__symbol">{ticker}</span>
                <span className="heatmap__change">
                  {item.change_pct > 0 ? "+" : ""}
                  {item.change_pct.toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
