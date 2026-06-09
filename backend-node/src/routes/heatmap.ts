import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

import { BinanceClient } from '../clients/binance.ts';
import { TickerSchema } from '../schemas/market.ts';

const HEATMAP_SIZE = 20;

export const heatmapRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/heatmap',
    {
      schema: {
        response: { 200: Type.Array(TickerSchema) },
      },
    },
    async (request) => {
      const binance = new BinanceClient(fastify.config.BINANCE_BASE_URL, request.log);
      const tickers = await binance.getUsdtTickers();
      const top = [...tickers]
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, HEATMAP_SIZE);
      request.log.debug({ count: top.length }, 'heatmap served');
      return top;
    },
  );
};
