import type { FastifyBaseLogger } from 'fastify';
import type { TrendingCoin } from '../../../../shared/types/market.ts';
import { UpstreamParseError } from '../errors/upstream.ts';
import { fetchWithTimeout } from '../http/fetchWithTimeout.ts';
import { parseNum } from '../http/parseNum.ts';

/**
 * CoinGecko thin client. Only owns the endpoints the dashboard needs —
 * fundamentals for the coin_info node live in `agent_service` because that's
 * where the LLM pipeline runs.
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
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly defaultLog: FastifyBaseLogger,
  ) {}

  /** Top trending coins. Used by the sidebar TrendingPanel. */
  async getTrending(log?: FastifyBaseLogger): Promise<TrendingCoin[]> {
    const logger = log ?? this.defaultLog;
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
