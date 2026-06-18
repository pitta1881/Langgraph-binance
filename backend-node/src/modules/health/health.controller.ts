import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

export const healthController: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Returns 200 with a static OK payload. Used by orchestrators and uptime probes.',
        response: {
          200: Type.Object({ status: Type.Literal('ok') }),
        },
      },
    },
    async () => ({ status: 'ok' as const }),
  );
};
