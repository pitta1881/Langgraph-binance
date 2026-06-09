import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

import { BinanceClient, InvalidSymbolError } from '../clients/binance.ts';
import { KlineSchema, KlinesQuerySchema, SymbolParamSchema } from '../schemas/market.ts';

export const klinesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/klines/:symbol',
    {
      schema: {
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
      const binance = new BinanceClient(fastify.config.BINANCE_BASE_URL, request.log);
      try {
        return await binance.getKlines(symbol.toUpperCase(), interval, limit);
      } catch (err) {
        if (err instanceof InvalidSymbolError) {
          return reply.code(422).send({ detail: err.message });
        }
        throw err;
      }
    },
  );
};
