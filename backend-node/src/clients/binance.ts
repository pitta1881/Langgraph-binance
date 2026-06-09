import type { FastifyBaseLogger } from 'fastify';
import type { Kline, Ticker } from '../schemas/market.ts';

/**
 * Thin wrapper around Binance public REST endpoints.
 *
 * Mirrors what `agent_service/binance/real_client.py` does for the agent,
 * but lives here because market-data endpoints are the gateway's job — the
 * Python service should only own the LLM pipeline.
 *
 * No API key is needed for any of these endpoints.
 */
export class BinanceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Top USDT pairs by 24h quote volume. Used by /heatmap and /ticker/banner. */
  async getUsdtTickers(): Promise<Ticker[]> {
    const url = `${this.baseUrl}/api/v3/ticker/24hr`;
    this.log.debug({ url }, 'binance: fetching all 24h tickers');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance ticker/24hr failed: ${res.status}`);
    const raw = (await res.json()) as Array<Record<string, string>>;

    const tickers: Ticker[] = raw
      .filter((t) => t.symbol?.endsWith('USDT'))
      .map((t) => ({
        symbol: t.symbol!,
        price: Number(t.lastPrice),
        change_pct: Number(t.priceChangePercent),
        volume: Number(t.quoteVolume),
      }));

    this.log.debug({ count: tickers.length }, 'binance: USDT tickers parsed');
    return tickers;
  }

  /** Candlestick history for a symbol. Used by /klines/:symbol. */
  async getKlines(symbol: string, interval: string, limit: number): Promise<Kline[]> {
    const url = new URL(`${this.baseUrl}/api/v3/klines`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', interval);
    url.searchParams.set('limit', String(limit));

    this.log.debug({ url: url.toString() }, 'binance: fetching klines');
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) throw new InvalidSymbolError(symbol);
      throw new Error(`Binance klines failed: ${res.status}`);
    }
    const raw = (await res.json()) as unknown[][];

    return raw.map((k) => ({
      open_time: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      close_time: Number(k[6]),
    }));
  }
}

export class InvalidSymbolError extends Error {
  constructor(public readonly symbol: string) {
    super(`Invalid symbol: ${symbol}`);
    this.name = 'InvalidSymbolError';
  }
}
