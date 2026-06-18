import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { ChatRequestSchema, ChatResponseSchema } from './chat.schema.ts';
import { AgentNoResponseError, type ChatService } from './chat.service.ts';

export function makeChatController(service: ChatService): FastifyPluginAsyncTypebox {
  return async (fastify) => {
    fastify.post(
      '/chat',
      {
        schema: {
          tags: ['Chat'],
          summary: 'Forward a message to the LangGraph agent',
          description:
            'Proxies the user message (and an optional conversation history of up to 10 turns) to '
            + 'the Python agent service. Returns the final response plus the resolved intent and '
            + 'symbol so the frontend can reconstruct compact history for the next turn.',
          body: ChatRequestSchema,
          response: {
            200: ChatResponseSchema,
            401: Type.Object({ error: Type.String() }),
            502: Type.Object({ detail: Type.String() }),
          },
        },
        preHandler: fastify.verifyAuth,
      },
      async (request, reply) => {
        try {
          return await service.processTurn({
            userId: request.user!.id,
            userEmail: request.user!.email,
            request: request.body,
            log: request.log,
          });
        } catch (err) {
          if (err instanceof AgentNoResponseError) {
            return reply.code(502).send({ detail: err.message });
          }
          request.log.error({ err }, 'chat: agent call failed');
          return reply.code(502).send({
            detail: err instanceof Error ? err.message : 'Unknown agent error',
          });
        }
      },
    );
  };
}
