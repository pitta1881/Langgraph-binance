import { useMemo } from "react";
import type { Ticker } from "../../../shared/types/market.ts";
import { usePolling } from "../hooks/usePolling";
import "./TickerBanner.css";

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

export function TickerBanner() {
  const { data, loading, error } = usePolling<Ticker[]>("/ticker/banner", 15_000);

  const doubled = useMemo<Array<Ticker & { half: "a" | "b" }>>(() => {
    if (!data || data.length === 0) return [];
    return [
      ...data.map((t) => ({ ...t, half: "a" as const })),
      ...data.map((t) => ({ ...t, half: "b" as const })),
    ];
  }, [data]);

  if (loading && !data) {
    return (
      <div className="ticker-banner ticker-banner--skeleton" aria-hidden="true">
        <span className="ticker-banner__loading">Cargando precios...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="ticker-banner" aria-hidden="true">
        <span className="ticker-banner__loading">
          Error al cargar precios
        </span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="ticker-banner" aria-hidden="true" />;
  }

  return (
    <div className="ticker-banner" aria-label="Precios en tiempo real">
      <div className="ticker-banner__track">
        {doubled.map((t) => (
          <span
            key={`${t.symbol}-${t.half}`}
            className="ticker-banner__item"
          >
            <span className="ticker-banner__symbol">
              {t.symbol.replace("USDT", "")}
            </span>
            <span className="ticker-banner__price">${formatPrice(t.price)}</span>
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
