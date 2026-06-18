import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { TrendingCoin } from "../../../shared/types/market.ts";
import { usePolling } from "../hooks/usePolling";
import { useAuth } from "../auth/useAuth";
import { useFavorites } from "../favorites/useFavorites";
import { PanelTitle } from "./PanelTitle";
import { CoinMenu } from "./CoinMenu";
import type { CoinMenuCoin } from "./CoinMenu";
import { FavoriteStar } from "./FavoriteStar";

interface Props {
  onCoinClick?: (ticker: string) => void;
}

export function TrendingPanel({ onCoinClick }: Props) {
  const { data: items, loading, error } = usePolling<TrendingCoin[]>("/trending", 60_000);
  const [menu, setMenu] = useState<{ coin: CoinMenuCoin; x: number; y: number } | null>(null);
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();

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
    <div className="bg-bg-surface rounded-md p-2 flex-shrink-0">
      <PanelTitle>📈 Tendencias</PanelTitle>

      {loading && !items && (
        <p className="text-[0.78rem] text-text-muted text-center py-3">Cargando...</p>
      )}
      {error && !items && (
        <p className="text-[0.78rem] text-text-muted text-center py-3" role="alert">
          Error al cargar tendencias
        </p>
      )}

      {items && (
        <ul className="list-none">
          {items.map((item, i) => (
            <li
              key={item.symbol}
              className="flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors hover:bg-bg-raised"
              role="button"
              tabIndex={0}
              aria-label={`Ver opciones para ${item.symbol.toUpperCase()}`}
              onClick={(e) => handleClick(e, item)}
              onKeyDown={(e) => handleKeyDown(e, item.symbol)}
            >
              <span className="text-[0.7rem] text-text-faint w-5 text-right flex-shrink-0">
                #{i + 1}
              </span>
              <img
                className="w-5 h-5 rounded-full flex-shrink-0"
                src={item.thumb}
                alt={item.name}
                width={20}
                height={20}
              />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[0.8rem] text-text-primary truncate">{item.name}</span>
                <span className="text-[0.68rem] text-text-muted">
                  {item.symbol.toUpperCase()}
                </span>
              </div>
              {item.market_cap_rank !== null && (
                <span className="text-[0.68rem] text-text-faint flex-shrink-0">
                  #{item.market_cap_rank}
                </span>
              )}
              {user && (
                <FavoriteStar
                  active={isFavorite(item.symbol)}
                  onToggle={() => void toggle(item.symbol)}
                  className="flex-shrink-0 ml-1"
                  ariaLabel={`${isFavorite(item.symbol) ? "Quitar" : "Agregar"} ${item.symbol.toUpperCase()} a favoritos`}
                />
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
