import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

import { CoingeckoClient } from '../clients/coingecko.ts';
import { TrendingCoinSchema } from '../schemas/market.ts';

export const trendingRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/trending',
    {
      schema: {
        response: { 200: Type.Array(TrendingCoinSchema) },
      },
    },
    async (request) => {
      const client = new CoingeckoClient(
        fastify.config.COINGECKO_BASE_URL,
        fastify.config.COINGECKO_API_KEY,
        request.log,
      );
      return client.getTrending();
    },
  );
};
