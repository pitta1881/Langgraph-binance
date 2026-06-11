import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Ticker } from "../../../shared/types/market.ts";
import { usePolling } from "../hooks/usePolling";
import { PanelTitle } from "./PanelTitle";
import { CoinMenu } from "./CoinMenu";
import type { CoinMenuCoin } from "./CoinMenu";
import "./Heatmap.css";

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
  const [tooltip, setTooltip] = useState<{ item: Ticker; x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ coin: CoinMenuCoin; x: number; y: number } | null>(null);

  const handleMouseEnter = (e: MouseEvent<HTMLButtonElement>, item: Ticker) => {
    setTooltip({ item, x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (tooltip) setTooltip((prev) => prev && { ...prev, x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => setTooltip(null);

  const handleClick = (e: MouseEvent<HTMLButtonElement>, item: Ticker) => {
    e.stopPropagation();
    setTooltip(null);
    const ticker = item.symbol.replace("USDT", "");
    setMenu({
      coin: { ticker: item.symbol, price: item.price, symbol: ticker },
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, item: Ticker) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const ticker = item.symbol.replace("USDT", "");
      onCoinClick?.(ticker);
    }
  };

  return (
    <div className="heatmap panel-shell">
      <PanelTitle>🔥 Volumen 24h</PanelTitle>

      {loading && !data && <p className="heatmap__status">Cargando...</p>}
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
                onClick={(e) => handleClick(e, item)}
                onMouseEnter={(e) => handleMouseEnter(e, item)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onKeyDown={(e) => handleKeyDown(e, item)}
                aria-label={`Ver opciones para ${ticker}`}
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

      {tooltip && (
        <div
          className="heatmap__tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <span className="heatmap__tooltip-symbol">
            {tooltip.item.symbol.replace("USDT", "")}
          </span>
          <span className="heatmap__tooltip-price">
            ${tooltip.item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
          </span>
          <span
            className={`heatmap__tooltip-change ${tooltip.item.change_pct >= 0 ? "pos" : "neg"}`}
          >
            {tooltip.item.change_pct > 0 ? "+" : ""}
            {tooltip.item.change_pct.toFixed(2)}%
          </span>
        </div>
      )}

      {menu && (
        <CoinMenu
          coin={menu.coin}
          position={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
