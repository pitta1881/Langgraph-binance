import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
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
        const { message, history, model, session_id } = request.body;
        const chat_id = randomUUID();
        const resolvedModel = model ?? 'gemini-3.1-flash-lite';
        const t0 = performance.now();

        // Stub insert FIRST so node_traces.chat_id FK is satisfied while the
        // agent is still running. We UPDATE the row with the final result below.
        const { error: stubError } = await fastify.supabase.from('chats').insert({
          id: chat_id,
          session_id,
          user_id: request.user!.id,
          user_email: request.user!.email,
          message,
          model: resolvedModel,
        });

        if (stubError) {
          request.log.warn({ err: stubError, chat_id }, 'chat: failed to persist chat stub');
        }

        const state = await fastify.pythonAgent.runAgent(
          message,
          { history, model, session_id, chat_id },
          request.log,
        );

        const latency_ms = Math.round(performance.now() - t0);

        request.log.debug(
          {
            intent: state.intent,
            symbol: state.symbol,
            responseLength: state.response?.length ?? 0,
            latency_ms,
          },
          'chat: agent finished',
        );

        if (!state.response) {
          request.log.warn({ intent: state.intent, symbol: state.symbol }, 'chat: agent returned no response');
          return reply.code(502).send({ detail: 'Agent returned no response' });
        }

        const { error: dbError } = await fastify.supabase
          .from('chats')
          .update({
            intent: state.intent,
            symbol: state.symbol ?? null,
            response: state.response,
            latency_ms,
          })
          .eq('id', chat_id);

        if (dbError) {
          request.log.warn({ err: dbError, chat_id }, 'chat: failed to update chat row');
        }

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
