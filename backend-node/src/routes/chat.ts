import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

import { PythonAgentClient } from '../clients/pythonAgent.ts';
import { ChatRequestSchema, ChatResponseSchema } from '../schemas/chat.ts';

const FALLBACK_RESPONSE =
  'No se recibió respuesta del agente. Intentá de nuevo en unos segundos.';

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
      const client = new PythonAgentClient(
        fastify.config.PYTHON_AGENT_URL,
        request.log,
      );

      try {
        const state = await client.runAgent(request.body.message);
        // Full state goes to debug log so we can trace agent behavior without
        // re-running the call. The frontend only needs `response`.
        request.log.debug({ state }, 'chat: agent finished');
        return { response: state.response ?? FALLBACK_RESPONSE };
      } catch (err) {
        request.log.error({ err }, 'chat: agent call failed');
        return reply.code(502).send({
          detail: err instanceof Error ? err.message : 'Unknown agent error',
        });
      }
    },
  );
};
