import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

import { BinanceClient } from '../clients/binance.ts';
import { TickerSchema } from '../schemas/market.ts';

const BANNER_SIZE = 10;

export const tickerBannerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/ticker/banner',
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
        .slice(0, BANNER_SIZE)
        .map(({ symbol, price, change_pct }) => ({ symbol, price, change_pct }));
      request.log.debug({ count: top.length }, 'ticker banner served');
      return top;
    },
  );
};
