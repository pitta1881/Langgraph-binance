import type { FastifyBaseLogger } from 'fastify';
import type { TrendingCoin } from '../../../shared/types/market.ts';
import { UpstreamParseError } from './_errors.ts';
import { fetchWithTimeout } from './_fetch.ts';
import { parseNum } from '../utils/parseNum.ts';

/**
 * CoinGecko thin client.
 *
 * Only owns what the dashboard needs (`/search/trending`). The agent service
 * has its own deeper CoinGecko client for fundamentals (used by the coin_info
 * node) — duplicating the HTTP shape is the right cost to keep services
 * decoupled.
 */

interface TrendingCoinItem {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb?: string;
  price_btc?: number | string;
  data?: { price?: number | string };
}

export class CoingeckoClient {
  private readonly log: FastifyBaseLogger;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    log: FastifyBaseLogger,
  ) {
    this.log = log;
  }

  /** Top trending coins. Used by the sidebar TrendingPanel. */
  async getTrending(log?: FastifyBaseLogger): Promise<TrendingCoin[]> {
    const logger = log ?? this.log;
    const url = `${this.baseUrl}/api/v3/search/trending`;
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['x-cg-demo-api-key'] = this.apiKey;

    logger.debug({ url }, 'coingecko: fetching trending');
    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko trending failed: ${res.status}`);

    let json: { coins?: Array<{ item: TrendingCoinItem }> };
    try {
      json = (await res.json()) as { coins?: Array<{ item: TrendingCoinItem }> };
    } catch {
      throw new UpstreamParseError({ url, status: res.status });
    }

    const coins = (json.coins ?? []).slice(0, 10).map(({ item }) => ({
      name: item.name,
      symbol: item.symbol,
      market_cap_rank: item.market_cap_rank ?? null,
      thumb: item.thumb ?? '',
      coingecko_id: item.id,
      price_btc: parseNum(item.price_btc ?? 0, 'price_btc', url),
      price_usd: parseNum(item.data?.price ?? 0, 'price_usd', url),
    }));
    logger.debug({ count: coins.length }, 'coingecko: trending parsed');
    return coins;
  }
}
