import type { Ticker } from '../../../shared/types/market.ts';

/**
 * Returns the top `n` tickers by 24h quote volume, descending.
 * Pure function — no Fastify dependencies.
 */
export function topByVolume(tickers: Ticker[], n: number): Ticker[] {
  return [...tickers].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, n);
}
