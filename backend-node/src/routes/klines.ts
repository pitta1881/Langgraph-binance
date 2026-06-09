import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { InvalidSymbolError } from '../clients/_errors.ts';
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
      try {
        return await fastify.binance.getKlines(symbol.toUpperCase(), interval, limit, request.log);
      } catch (err) {
        if (err instanceof InvalidSymbolError) {
          return reply.code(422).send({ detail: err.message });
        }
        request.log.error({ err, route: 'klines', symbol }, 'upstream failed');
        throw err;
      }
    },
  );
};
