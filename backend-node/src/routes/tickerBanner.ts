import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { TickerSchema } from '../schemas/market.ts';
import { topByVolume } from '../utils/market.ts';
import { BANNER_SIZE } from '../constants.ts';

export const tickerBannerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/ticker/banner',
    {
      schema: {
        response: { 200: Type.Array(TickerSchema) },
      },
    },
    async (request) => {
      try {
        const tickers = await fastify.binance.getUsdtTickers(request.log);
        const top = topByVolume(tickers, BANNER_SIZE).map(({ symbol, price, change_pct }) => ({
          symbol,
          price,
          change_pct,
        }));
        request.log.debug({ count: top.length }, 'ticker banner served');
        return top;
      } catch (err) {
        request.log.error({ err, route: 'tickerBanner' }, 'upstream failed');
        throw err;
      }
    },
  );
};
