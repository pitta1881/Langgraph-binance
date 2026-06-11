import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Ticker } from "../../../shared/types/market.ts";
import { usePolling } from "../hooks/usePolling";
import { PanelTitle } from "./PanelTitle";
import { CoinMenu } from "./CoinMenu";
import type { CoinMenuCoin } from "./CoinMenu";

const THRESHOLD_STRONG = 5;
const THRESHOLD_MID = 2;
const THRESHOLD_ZERO = 0;
const THRESHOLD_MID_NEG = -2;
const THRESHOLD_STRONG_NEG = -5;

function getColorVar(changePct: number): string {
  if (changePct > THRESHOLD_STRONG) return "var(--color-heatmap-green-strong)";
  if (changePct > THRESHOLD_MID) return "var(--color-heatmap-green-mid)";
  if (changePct > THRESHOLD_ZERO) return "var(--color-heatmap-green-weak)";
  if (changePct > THRESHOLD_MID_NEG) return "var(--color-heatmap-red-weak)";
  if (changePct > THRESHOLD_STRONG_NEG) return "var(--color-heatmap-red-mid)";
  return "var(--color-heatmap-red-strong)";
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
      onCoinClick?.(item.symbol.replace("USDT", ""));
    }
  };

  return (
    <div className="bg-bg-surface rounded-md overflow-hidden p-2">
      <PanelTitle>🔥 Volumen 24h</PanelTitle>

      {loading && !data && (
        <p className="text-[0.78rem] text-text-muted text-center py-3">Cargando...</p>
      )}
      {error && !data && (
        <p className="text-[0.78rem] text-text-muted text-center py-3" role="alert">
          Error al cargar datos
        </p>
      )}

      {data && (
        <div className="grid grid-cols-4 gap-[3px]">
          {data.map((item) => {
            const ticker = item.symbol.replace("USDT", "");
            return (
              <button
                key={item.symbol}
                className="flex flex-col items-center justify-center py-2.5 px-1 rounded-[5px] cursor-pointer transition-[transform,filter] duration-150 min-h-[56px] border-0 hover:scale-[1.06] hover:brightness-[1.35] hover:relative hover:z-[1] focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-[1px]"
                style={{ backgroundColor: getColorVar(item.change_pct) }}
                onClick={(e) => handleClick(e, item)}
                onMouseEnter={(e) => handleMouseEnter(e, item)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onKeyDown={(e) => handleKeyDown(e, item)}
                aria-label={`Ver opciones para ${ticker}`}
              >
                <span className="text-[0.72rem] font-bold text-white/90 tracking-[0.01em]">
                  {ticker}
                </span>
                <span className="text-[0.62rem] text-white/75 mt-0.5 tabular-nums">
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
          className="fixed bg-bg-raised border border-border rounded-sm px-2.5 py-1.5 text-[0.75rem] pointer-events-none z-[100] whitespace-nowrap flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <span className="font-bold text-text-primary text-[0.72rem] tracking-[0.04em]">
            {tooltip.item.symbol.replace("USDT", "")}
          </span>
          <span className="text-text-secondary tabular-nums">
            ${tooltip.item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
          </span>
          <span className={`tabular-nums text-[0.72rem] ${tooltip.item.change_pct >= 0 ? "text-heatmap-green-mid" : "text-heatmap-red-mid"}`}>
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
