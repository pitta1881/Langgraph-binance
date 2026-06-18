import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { InvalidSymbolError } from '../../shared/errors/upstream.ts';
import {
  KlineSchema,
  KlinesQuerySchema,
  SymbolParamSchema,
  TickerSchema,
  TrendingCoinSchema,
} from './market.schema.ts';
import type { MarketService } from './market.service.ts';

export function makeMarketController(service: MarketService): FastifyPluginAsyncTypebox {
  return async (fastify) => {
    fastify.get(
      '/heatmap',
      {
        schema: {
          tags: ['Market'],
          summary: 'Top 20 USDT pairs by 24h volume',
          description:
            'Aggregates Binance 24h ticker data, filters to *USDT pairs, sorts by quote volume, '
            + 'and returns the top 20. Used to render the dashboard heatmap.',
          response: { 200: Type.Array(TickerSchema) },
        },
      },
      async (request) => {
        try {
          return await service.getHeatmap(request.log);
        } catch (err) {
          request.log.error({ err, route: 'heatmap' }, 'upstream failed');
          throw err;
        }
      },
    );

    fastify.get(
      '/ticker/banner',
      {
        schema: {
          tags: ['Market'],
          summary: 'Top 10 USDT pairs for the scrolling banner',
          description:
            'Same source as /heatmap but trimmed to the top 10 and stripped of the volume field. '
            + 'Polled every 15s by the frontend.',
          response: { 200: Type.Array(TickerSchema) },
        },
      },
      async (request) => {
        try {
          return await service.getTickerBanner(request.log);
        } catch (err) {
          request.log.error({ err, route: 'tickerBanner' }, 'upstream failed');
          throw err;
        }
      },
    );

    fastify.get(
      '/klines/:symbol',
      {
        schema: {
          tags: ['Market'],
          summary: 'Candlestick history for a symbol',
          description:
            'Proxies Binance /api/v3/klines. The `interval` query param is a constrained union '
            + '(1m, 5m, 1h, 4h, 1d, etc); invalid values get a 400. Unknown symbols get 422.',
          params: SymbolParamSchema,
          querystring: KlinesQuerySchema,
          response: {
            200: Type.Array(KlineSchema),
            422: Type.Object({ detail: Type.String() }),
          },
        },
      },
      async (request, reply) => {
        const { symbol } = request.params;
        const { interval, limit } = request.query;
        try {
          return await service.getKlines(symbol, interval, limit, request.log);
        } catch (err) {
          if (err instanceof InvalidSymbolError) {
            return reply.code(422).send({ detail: err.message });
          }
          request.log.error({ err, route: 'klines', symbol }, 'upstream failed');
          throw err;
        }
      },
    );

    fastify.get(
      '/trending',
      {
        schema: {
          tags: ['Market'],
          summary: 'Trending coins from CoinGecko',
          description: 'Top trending coins from CoinGecko /search/trending. Used by the sidebar TrendingPanel.',
          response: { 200: Type.Array(TrendingCoinSchema) },
        },
      },
      async (request) => {
        try {
          return await service.getTrending(request.log);
        } catch (err) {
          request.log.error({ err, route: 'trending' }, 'upstream failed');
          throw err;
        }
      },
    );
  };
}
