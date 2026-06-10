import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { ChatRequestSchema, ChatResponseSchema } from '../schemas/chat.ts';

export const chatRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/chat',
    {
      schema: {
        tags: ['Chat'],
        summary: 'Forward a message to the LangGraph agent',
        description:
          'Proxies the user message (and an optional conversation history of up to 20 turns) to '
          + 'the Python agent service. Returns the final response plus the resolved intent and '
          + 'symbol so the frontend can reconstruct compact history for the next turn.',
        body: ChatRequestSchema,
        response: {
          200: ChatResponseSchema,
          502: Type.Object({ detail: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { message, history } = request.body;
        const state = await fastify.pythonAgent.runAgent(message, history, request.log);
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
        // Expose intent/symbol so the frontend can stash them on the assistant
        // message and replay them as compact history on the next turn.
        return {
          response: state.response,
          intent: state.intent,
          symbol: state.symbol ?? null,
        };
      } catch (err) {
        request.log.error({ err }, 'chat: agent call failed');
        return reply.code(502).send({
          detail: err instanceof Error ? err.message : 'Unknown agent error',
        });
      }
    },
  );
};
