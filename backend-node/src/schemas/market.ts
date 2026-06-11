import { Type, type Static } from '@sinclair/typebox';
import type { Ticker as SharedTicker, Kline as SharedKline, TrendingCoin as SharedTrendingCoin } from '../../../shared/types/market.ts';

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
// Assignability assertion: Static<TickerSchema> must satisfy the shared contract.
const _tickerCheck: SharedTicker = {} as Ticker;
void _tickerCheck;

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
const _klineCheck: SharedKline = {} as Kline;
void _klineCheck;

export const TrendingCoinSchema = Type.Object({
  name: Type.String(),
  symbol: Type.String(),
  coingecko_id: Type.String(),
  market_cap_rank: Type.Union([Type.Number(), Type.Null()]),
  thumb: Type.String(),
  price_btc: Type.Number(),
  price_usd: Type.Number(),
});
export type TrendingCoin = Static<typeof TrendingCoinSchema>;
const _trendingCoinCheck: SharedTrendingCoin = {} as TrendingCoin;
void _trendingCoinCheck;

export const KlinesQuerySchema = Type.Object({
  interval: Type.Union(
    [
      Type.Literal('1m'),
      Type.Literal('3m'),
      Type.Literal('5m'),
      Type.Literal('15m'),
      Type.Literal('30m'),
      Type.Literal('1h'),
      Type.Literal('2h'),
      Type.Literal('4h'),
      Type.Literal('6h'),
      Type.Literal('8h'),
      Type.Literal('12h'),
      Type.Literal('1d'),
      Type.Literal('3d'),
      Type.Literal('1w'),
      Type.Literal('1M'),
    ],
    { default: '4h' },
  ),
  limit: Type.Number({ default: 42, minimum: 1, maximum: 1000 }),
});
export type KlinesQuery = Static<typeof KlinesQuerySchema>;

export const SymbolParamSchema = Type.Object({
  symbol: Type.String({ minLength: 2 }),
});
