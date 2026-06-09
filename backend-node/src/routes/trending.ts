import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
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
      try {
        return await fastify.coingecko.getTrending(request.log);
      } catch (err) {
        request.log.error({ err, route: 'trending' }, 'upstream failed');
        throw err;
      }
    },
  );
};
