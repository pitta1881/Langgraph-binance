import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { ChatRequestSchema, ChatResponseSchema } from '../schemas/chat.ts';

export const chatRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/chat',
    {
      schema: {
        body: ChatRequestSchema,
        response: {
          200: ChatResponseSchema,
          502: Type.Object({ detail: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const state = await fastify.pythonAgent.runAgent(request.body.message, request.log);
        request.log.debug(
          {
            intent: state.intent,
            symbol: state.symbol,
            responseLength: state.response?.length ?? 0,
          },
          'chat: agent finished',
        );
        if (!state.response) {
          request.log.warn({ intent: state.intent, symbol: state.symbol }, 'chat: agent returned no response');
          return reply.code(502).send({ detail: 'Agent returned no response' });
        }
        return { response: state.response };
      } catch (err) {
        request.log.error({ err }, 'chat: agent call failed');
        return reply.code(502).send({
          detail: err instanceof Error ? err.message : 'Unknown agent error',
        });
      }
    },
  );
};
