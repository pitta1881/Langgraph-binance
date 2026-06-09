import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

export const healthRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        response: {
          200: Type.Object({ status: Type.Literal('ok') }),
        },
      },
    },
    async () => {
      return { status: 'ok' as const };
    },
  );
};
