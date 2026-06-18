import { useMemo } from "react";
import type { Ticker } from "../../../shared/types/market.ts";
import { usePolling } from "../hooks/usePolling";
import { useAuth } from "../auth/useAuth";
import { useFavorites } from "../favorites/useFavorites";
import { PanelTitle } from "./PanelTitle";

interface Props {
  onCoinClick?: (ticker: string) => void;
}

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 })}`;
}

export function FavoritesPanel({ onCoinClick }: Props) {
  const { user } = useAuth();
  const { favorites, remove } = useFavorites();
  const { data } = usePolling<Ticker[]>("/heatmap", 30_000);

  const enriched = useMemo(() => {
    if (favorites.size === 0) return [];
    const priceMap = new Map<string, Ticker>();
    for (const t of data ?? []) {
      priceMap.set(t.symbol.replace("USDT", ""), t);
    }
    return Array.from(favorites).map((symbol) => {
      const t = priceMap.get(symbol) ?? null;
      return {
        symbol,
        price: t?.price ?? null,
        change_pct: t?.change_pct ?? null,
      };
    });
  }, [favorites, data]);

  if (!user || favorites.size === 0) return null;

  return (
    <div className="bg-bg-surface rounded-md p-2 pb-3 flex-shrink-0">
      <PanelTitle>⭐ Mis favoritas</PanelTitle>
      <ul className="list-none flex flex-col gap-0.5">
        {enriched.map((item) => (
          <li
            key={item.symbol}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors hover:bg-bg-raised"
            role="button"
            tabIndex={0}
            onClick={() => onCoinClick?.(item.symbol)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCoinClick?.(item.symbol);
              }
            }}
            aria-label={`Usar ${item.symbol} en el chat`}
          >
            <span className="text-[0.78rem] font-semibold text-text-primary w-12 flex-shrink-0">
              {item.symbol}
            </span>
            <span className="text-[0.72rem] text-text-secondary tabular-nums flex-1 truncate">
              {item.price !== null ? formatPrice(item.price) : "—"}
            </span>
            {item.change_pct !== null && (
              <span
                className={`text-[0.68rem] tabular-nums flex-shrink-0 ${
                  item.change_pct >= 0 ? "text-heatmap-green-mid" : "text-heatmap-red-mid"
                }`}
              >
                {item.change_pct > 0 ? "+" : ""}
                {item.change_pct.toFixed(1)}%
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void remove(item.symbol);
              }}
              className="text-text-faint hover:text-text-primary transition-colors text-xs px-1 cursor-pointer bg-transparent border-0 leading-none flex-shrink-0"
              aria-label={`Quitar ${item.symbol} de favoritos`}
              title="Quitar"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
