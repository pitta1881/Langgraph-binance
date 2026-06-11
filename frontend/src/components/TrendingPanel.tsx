import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { TrendingCoin } from "../../../shared/types/market.ts";
import { usePolling } from "../hooks/usePolling";
import { PanelTitle } from "./PanelTitle";
import { CoinMenu } from "./CoinMenu";
import type { CoinMenuCoin } from "./CoinMenu";
import "./TrendingPanel.css";

interface Props {
  onCoinClick?: (ticker: string) => void;
}

export function TrendingPanel({ onCoinClick }: Props) {
  const { data: items, loading, error } = usePolling<TrendingCoin[]>("/trending", 60_000);
  const [menu, setMenu] = useState<{ coin: CoinMenuCoin; x: number; y: number } | null>(null);

  const handleClick = (e: MouseEvent<HTMLLIElement>, item: TrendingCoin) => {
    e.stopPropagation();
    setMenu({
      coin: {
        ticker: `${item.symbol.toUpperCase()}USDT`,
        price: item.price_usd,
        symbol: item.symbol,
        coingeckoId: item.coingecko_id,
      },
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLLIElement>, symbol: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onCoinClick?.(symbol.toUpperCase());
    }
  };

  return (
    <div className="trending panel-shell">
      <PanelTitle>📈 Tendencias</PanelTitle>

      {loading && !items && <p className="trending__status">Cargando...</p>}
      {error && !items && (
        <p className="trending__status" role="alert">
          Error al cargar tendencias
        </p>
      )}

      {items && (
        <ul className="trending__list">
          {items.map((item, i) => (
            <li
              key={item.symbol}
              className="trending__item"
              role="button"
              tabIndex={0}
              aria-label={`Ver opciones para ${item.symbol.toUpperCase()}`}
              onClick={(e) => handleClick(e, item)}
              onKeyDown={(e) => handleKeyDown(e, item.symbol)}
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
              {item.market_cap_rank !== null && (
                <span className="trending__mcap">#{item.market_cap_rank}</span>
              )}
            </li>
          ))}
        </ul>
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
