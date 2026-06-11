import { useEffect, useRef, useState } from "react";
import "./CoinMenu.css";

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

  // Adjust position so menu doesn't overflow viewport
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
    if (price >= 1) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 })}`;
  };

  return (
    <div ref={ref} className="coin-menu" style={style} role="menu">
      <div className="coin-menu__price">
        <span className="coin-menu__ticker">{baseTicker}</span>
        <span>{formatPrice(coin.price)}</span>
      </div>
      <button className="coin-menu__item" onClick={handleCopy} role="menuitem">
        {copied ? "✓ Copiado" : "Copiar ticker"}
      </button>
      <a
        className="coin-menu__item"
        href={binanceUrl}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
      >
        Abrir en Binance ↗
      </a>
      <a
        className="coin-menu__item"
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
