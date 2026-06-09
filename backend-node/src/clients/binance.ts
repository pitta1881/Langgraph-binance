import type { FastifyBaseLogger } from 'fastify';
import type { Kline, Ticker } from '../../../shared/types/market.ts';
import { InvalidSymbolError, UpstreamParseError } from './_errors.ts';
import { fetchWithTimeout } from './_fetch.ts';
import { parseNum } from '../utils/parseNum.ts';

/**
 * Binance public REST client.
 *
 * Mirrors what `agent_service/binance/real_client.py` does for the agent,
 * but lives here because market-data endpoints are the gateway's job — the
 * Python service should only own the LLM pipeline.
 *
 * No API key is needed for any of these endpoints.
 */

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

// Binance kline array: [openTime, open, high, low, close, volume, closeTime, ...]
type BinanceKlineRaw = readonly [number, string, string, string, string, string, number, ...unknown[]];

export class BinanceClient {
  private readonly log: FastifyBaseLogger;

  constructor(
    private readonly baseUrl: string,
    log: FastifyBaseLogger,
  ) {
    this.log = log;
  }

  /** Top USDT pairs by 24h quote volume. Used by /heatmap and /ticker/banner. */
  async getUsdtTickers(log?: FastifyBaseLogger): Promise<Ticker[]> {
    const logger = log ?? this.log;
    const url = `${this.baseUrl}/api/v3/ticker/24hr`;
    logger.debug({ url }, 'binance: fetching all 24h tickers');

    const res = await fetchWithTimeout(url, undefined);
    if (!res.ok) throw new Error(`Binance ticker/24hr failed: ${res.status}`);

    let raw: BinanceTicker24h[];
    try {
      raw = (await res.json()) as BinanceTicker24h[];
    } catch {
      throw new UpstreamParseError({ url, status: res.status });
    }

    const tickers: Ticker[] = raw
      .filter((t) => t.symbol?.endsWith('USDT'))
      .map((t) => ({
        symbol: t.symbol,
        price: parseNum(t.lastPrice, 'lastPrice', url),
        change_pct: parseNum(t.priceChangePercent, 'priceChangePercent', url),
        volume: parseNum(t.quoteVolume, 'quoteVolume', url),
      }));

    logger.debug({ count: tickers.length }, 'binance: USDT tickers parsed');
    return tickers;
  }

  /** Candlestick history for a symbol. Used by /klines/:symbol. */
  async getKlines(symbol: string, interval: string, limit: number, log?: FastifyBaseLogger): Promise<Kline[]> {
    const logger = log ?? this.log;
    const url = new URL(`${this.baseUrl}/api/v3/klines`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', interval);
    url.searchParams.set('limit', String(limit));

    logger.debug({ url: url.toString() }, 'binance: fetching klines');
    const res = await fetchWithTimeout(url, undefined);
    if (!res.ok) {
      if (res.status === 400) throw new InvalidSymbolError({ symbol });
      throw new Error(`Binance klines failed: ${res.status}`);
    }

    let raw: BinanceKlineRaw[];
    try {
      raw = (await res.json()) as BinanceKlineRaw[];
    } catch {
      throw new UpstreamParseError({ url: url.toString(), status: res.status });
    }

    return raw.map((k) => ({
      open_time: parseNum(k[0], 'open_time', url.toString()),
      open: parseNum(k[1], 'open', url.toString()),
      high: parseNum(k[2], 'high', url.toString()),
      low: parseNum(k[3], 'low', url.toString()),
      close: parseNum(k[4], 'close', url.toString()),
      volume: parseNum(k[5], 'volume', url.toString()),
      close_time: parseNum(k[6], 'close_time', url.toString()),
    }));
  }
}
