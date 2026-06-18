import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { useFavorites } from "../favorites/useFavorites";

export interface CoinMenuCoin {
  ticker: string;
  price: number | null;
  symbol: string;
  coingeckoId?: string;
}

interface Props {
  coin: CoinMenuCoin;
  position: { x: number; y: number };
  onClose: () => void;
}

export function CoinMenu({ coin, position, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    left: Math.min(position.x, window.innerWidth - 192),
    top: Math.min(position.y, window.innerHeight - 160),
  };

  const baseTicker = coin.ticker.replace(/USDT$/, "");
  const binanceUrl = `https://www.binance.com/en/trade/${baseTicker}_USDT`;
  const coingeckoUrl = coin.coingeckoId
    ? `https://www.coingecko.com/en/coins/${coin.coingeckoId}`
    : `https://www.coingecko.com/en/search?query=${baseTicker}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(baseTicker).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "–";
    if (price >= 1)
      return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 })}`;
  };

  const itemClass =
    "block w-full px-3 py-2 cursor-pointer text-[0.83rem] text-text-primary text-left bg-transparent border-0 font-[inherit] no-underline box-border hover:bg-bg-surface";

  return (
    <div
      ref={ref}
      className="fixed bg-bg-raised border border-border rounded-md min-w-[180px] z-[200] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
      style={style}
      role="menu"
    >
      <div className="flex justify-between items-center px-3 pt-2 pb-1.5 text-text-muted text-[0.8rem] cursor-default border-b border-border-soft gap-3">
        <span className="font-bold text-text-secondary text-[0.75rem] tracking-[0.04em]">
          {baseTicker}
        </span>
        <span>{formatPrice(coin.price)}</span>
      </div>
      {user && (
        <button
          className={itemClass}
          onClick={() => {
            void toggle(baseTicker);
            onClose();
          }}
          role="menuitem"
        >
          {isFavorite(baseTicker) ? "★ Quitar de favoritos" : "☆ Agregar a favoritos"}
        </button>
      )}
      <button className={itemClass} onClick={handleCopy} role="menuitem">
        {copied ? "✓ Copiado" : "Copiar ticker"}
      </button>
      <a
        className={itemClass}
        href={binanceUrl}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
      >
        Abrir en Binance ↗
      </a>
      <a
        className={itemClass}
        href={coingeckoUrl}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
      >
        Abrir en CoinGecko ↗
      </a>
    </div>
  );
}
