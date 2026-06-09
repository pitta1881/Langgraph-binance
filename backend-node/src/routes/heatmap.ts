import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { TickerSchema } from '../schemas/market.ts';
import { topByVolume } from '../utils/market.ts';
import { HEATMAP_SIZE } from '../constants.ts';

export const heatmapRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/heatmap',
    {
      schema: {
        response: { 200: Type.Array(TickerSchema) },
      },
    },
    async (request) => {
      try {
        const tickers = await fastify.binance.getUsdtTickers(request.log);
        const top = topByVolume(tickers, HEATMAP_SIZE);
        request.log.debug({ count: top.length }, 'heatmap served');
        return top;
      } catch (err) {
        request.log.error({ err, route: 'heatmap' }, 'upstream failed');
        throw err;
      }
    },
  );
};
