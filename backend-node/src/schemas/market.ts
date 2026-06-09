import { Type, type Static } from '@sinclair/typebox';

/**
 * Shapes consumed by the React frontend. Field names match the Python service
 * that this gateway replaces — changing them would break the dashboard.
 */

export const TickerSchema = Type.Object({
  symbol: Type.String(),
  price: Type.Number(),
  change_pct: Type.Number(),
  volume: Type.Optional(Type.Number()),
});
export type Ticker = Static<typeof TickerSchema>;

export const KlineSchema = Type.Object({
  open_time: Type.Number(),
  open: Type.Number(),
  high: Type.Number(),
  low: Type.Number(),
  close: Type.Number(),
  volume: Type.Number(),
  close_time: Type.Number(),
});
export type Kline = Static<typeof KlineSchema>;

export const TrendingCoinSchema = Type.Object({
  name: Type.String(),
  symbol: Type.String(),
  market_cap_rank: Type.Union([Type.Number(), Type.Null()]),
  thumb: Type.String(),
  price_btc: Type.Number(),
});
export type TrendingCoin = Static<typeof TrendingCoinSchema>;

export const KlinesQuerySchema = Type.Object({
  interval: Type.String({ default: '4h' }),
  limit: Type.Number({ default: 42, minimum: 1, maximum: 1000 }),
});

export const SymbolParamSchema = Type.Object({
  symbol: Type.String({ minLength: 2 }),
});
