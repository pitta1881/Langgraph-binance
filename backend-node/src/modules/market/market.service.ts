import type { FastifyBaseLogger } from 'fastify';
import type { BinanceClient } from '../../shared/infrastructure/binance.client.ts';
import type { CoingeckoClient } from '../../shared/infrastructure/coingecko.client.ts';
import { BANNER_SIZE, HEATMAP_SIZE } from '../../shared/constants.ts';
import type { Kline, Ticker, TrendingCoin } from './market.schema.ts';

/**
 * Returns the top `n` tickers by 24h quote volume, descending.
 * Pure helper kept inside the service file — there's no other consumer.
 */
function topByVolume(tickers: Ticker[], n: number): Ticker[] {
  return [...tickers].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, n);
}

export class MarketService {
  constructor(
    private readonly binance: BinanceClient,
    private readonly coingecko: CoingeckoClient,
  ) {}

  async getHeatmap(log?: FastifyBaseLogger): Promise<Ticker[]> {
    const tickers = await this.binance.getUsdtTickers(log);
    return topByVolume(tickers, HEATMAP_SIZE);
  }

  async getTickerBanner(
    extra: string[] = [],
    log?: FastifyBaseLogger,
  ): Promise<Omit<Ticker, 'volume'>[]> {
    const tickers = await this.binance.getUsdtTickers(log);
    const top = topByVolume(tickers, BANNER_SIZE);

    const bySymbol = new Map(tickers.map((t) => [t.symbol, t]));
    const topSymbols = new Set(top.map((t) => t.symbol));
    const seenExtras = new Set<string>();
    const extras: Ticker[] = [];
    for (const sym of extra) {
      const full = `${sym}USDT`;
      if (topSymbols.has(full) || seenExtras.has(full)) continue;
      const hit = bySymbol.get(full);
      if (!hit) continue;
      extras.push(hit);
      seenExtras.add(full);
    }

    return [...extras, ...top].map(({ symbol, price, change_pct }) => ({
      symbol,
      price,
      change_pct,
    }));
  }

  getKlines(symbol: string, interval: string, limit: number, log?: FastifyBaseLogger): Promise<Kline[]> {
    return this.binance.getKlines(symbol.toUpperCase(), interval, limit, log);
  }

  getTrending(log?: FastifyBaseLogger): Promise<TrendingCoin[]> {
    return this.coingecko.getTrending(log);
  }
}
