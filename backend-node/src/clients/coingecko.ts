import type { FastifyBaseLogger } from 'fastify';
import type { TrendingCoin } from '../schemas/market.ts';

/**
 * CoinGecko thin client.
 *
 * Only owns what the dashboard needs (`/search/trending`). The agent service
 * has its own deeper CoinGecko client for fundamentals (used by the coin_info
 * node) — duplicating the HTTP shape is the right cost to keep services
 * decoupled.
 */
export class CoingeckoClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Top trending coins. Used by the sidebar TrendingPanel. */
  async getTrending(): Promise<TrendingCoin[]> {
    const url = `${this.baseUrl}/api/v3/search/trending`;
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['x-cg-demo-api-key'] = this.apiKey;

    this.log.debug({ url }, 'coingecko: fetching trending');
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko trending failed: ${res.status}`);
    const json = (await res.json()) as { coins?: Array<{ item: TrendingCoinItem }> };

    const coins = (json.coins ?? []).slice(0, 10).map(({ item }) => ({
      name: item.name,
      symbol: item.symbol,
      market_cap_rank: item.market_cap_rank ?? null,
      thumb: item.thumb ?? '',
      price_btc: Number(item.price_btc ?? 0),
    }));
    this.log.debug({ count: coins.length }, 'coingecko: trending parsed');
    return coins;
  }
}

interface TrendingCoinItem {
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb?: string;
  price_btc?: number | string;
}
