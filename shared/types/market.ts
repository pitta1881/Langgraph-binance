/**
 * Contract types between the Fastify gateway and the React frontend.
 *
 * IMPORTANT: do not couple these to TypeBox or any runtime library — they are
 * pure structural types so the frontend can import them without installing
 * backend dependencies. Backend validates with TypeBox at runtime, but the
 * `Static<>` derivations must remain assignable to these shapes.
 */

export interface Ticker {
  symbol: string;
  price: number;
  change_pct: number;
  /** 24h quote volume in USD. Only present in /heatmap; /ticker/banner omits it. */
  volume?: number;
}

export interface Kline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  close_time: number;
}

export interface TrendingCoin {
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
  price_btc: number;
}

/** Valid Binance kline intervals, kept narrow so the gateway can validate. */
export type KlineInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M';

export interface KlinesQuery {
  interval?: KlineInterval;
  limit?: number;
}
