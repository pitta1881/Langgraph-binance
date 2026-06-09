/** All tracked Binance USDT pairs, keyed by base symbol for fast lookup. */
export const TRACKED_SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  BNB: "BNBUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  DOGE: "DOGEUSDT",
  DOT: "DOTUSDT",
  AVAX: "AVAXUSDT",
  MATIC: "MATICUSDT",
  LINK: "LINKUSDT",
  UNI: "UNIUSDT",
  ATOM: "ATOMUSDT",
  LTC: "LTCUSDT",
  NEAR: "NEARUSDT",
};

/**
 * Scans `text` for a known base symbol and returns the full pair (e.g. "BTCUSDT"),
 * or null if none is found.
 */
export function extractSymbol(text: string): string | null {
  const upper = text.toUpperCase();
  for (const [base, pair] of Object.entries(TRACKED_SYMBOLS)) {
    if (upper.includes(base)) return pair;
  }
  return null;
}
