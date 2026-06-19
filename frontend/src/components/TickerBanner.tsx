import { useMemo } from "react";
import type { Ticker } from "../../../shared/types/market.ts";
import { useFavorites } from "../favorites/useFavorites";
import { usePolling } from "../hooks/usePolling";

function formatPrice(price: number): string {
  if (price >= 1000)
    return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (price >= 1)
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  if (price >= 0.01) return price.toFixed(4);
  return price.toPrecision(4);
}

const bannerBase = "bg-bg-chat border-b border-border overflow-hidden h-[38px] flex items-center flex-shrink-0";

export function TickerBanner() {
  const { favorites } = useFavorites();
  const path = useMemo(() => {
    const extra = [...favorites].sort().join(",");
    return extra ? `/ticker/banner?extra=${encodeURIComponent(extra)}` : "/ticker/banner";
  }, [favorites]);
  const { data, loading, error } = usePolling<Ticker[]>(path, 15_000);

  const doubled = useMemo<Array<Ticker & { half: "a" | "b" }>>(() => {
    if (!data || data.length === 0) return [];
    return [
      ...data.map((t) => ({ ...t, half: "a" as const })),
      ...data.map((t) => ({ ...t, half: "b" as const })),
    ];
  }, [data]);

  if (loading && !data) {
    return (
      <div className={`${bannerBase} opacity-50`} aria-hidden="true">
        <span className="text-[0.78rem] text-text-muted px-4">Cargando precios...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={bannerBase} aria-hidden="true">
        <span className="text-[0.78rem] text-text-muted px-4">Error al cargar precios</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className={bannerBase} aria-hidden="true" />;
  }

  return (
    <div className={bannerBase} aria-label="Precios en tiempo real">
      <div className="flex animate-ticker-scroll whitespace-nowrap hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
        {doubled.map((t) => {
          const base = t.symbol.replace("USDT", "");
          const isFav = favorites.has(base);
          return (
          <span
            key={`${t.symbol}-${t.half}`}
            className="inline-flex gap-1.5 items-center text-[0.78rem] px-5 border-r border-border"
          >
            {isFav && (
              <span
                aria-label="Favorito"
                title="Favorito"
                className="leading-none text-[0.72rem]"
                style={{ color: "var(--color-warning)" }}
              >
                ★
              </span>
            )}
            <span className="text-text-secondary font-bold tracking-wide">
              {base}
            </span>
            <span className="text-text-primary tabular-nums">${formatPrice(t.price)}</span>
            <span
              className={`tabular-nums text-[0.72rem] ${
                t.change_pct >= 0 ? "text-green" : "text-red"
              }`}
            >
              {t.change_pct >= 0 ? "+" : ""}
              {t.change_pct.toFixed(2)}%
            </span>
          </span>
          );
        })}
      </div>
    </div>
  );
}
