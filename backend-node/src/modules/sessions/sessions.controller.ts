import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import {
  DeleteResponseSchema,
  SessionMessagesResponseSchema,
  SessionParamSchema,
  SessionsResponseSchema,
} from './sessions.schema.ts';
import type { SessionsService } from './sessions.service.ts';

export function makeSessionsController(service: SessionsService): FastifyPluginAsyncTypebox {
  return async (fastify) => {
    fastify.get(
      '/sessions',
      {
        schema: {
          tags: ['Sessions'],
          summary: 'List the current user\'s chat sessions grouped by session_id',
          response: {
            200: SessionsResponseSchema,
            401: Type.Object({ error: Type.String() }),
            502: Type.Object({ error: Type.String() }),
          },
        },
        preHandler: fastify.verifyAuth,
      },
      async (request, reply) => {
        try {
          return await service.listSessionsForUser(request.user!.id);
        } catch (err) {
          request.log.error({ err }, 'sessions: list failed');
          return reply.code(502).send({ error: 'Database error' });
        }
      },
    );

    fastify.get(
      '/sessions/:id',
      {
        schema: {
          tags: ['Sessions'],
          summary: 'List the messages of a single session belonging to the current user',
          params: SessionParamSchema,
          response: {
            200: SessionMessagesResponseSchema,
            401: Type.Object({ error: Type.String() }),
            502: Type.Object({ error: Type.String() }),
          },
        },
        preHandler: fastify.verifyAuth,
      },
      async (request, reply) => {
        try {
          return await service.getSessionMessages(request.params.id, request.user!.id);
        } catch (err) {
          request.log.error({ err, session_id: request.params.id }, 'sessions: messages query failed');
          return reply.code(502).send({ error: 'Database error' });
        }
      },
    );

    fastify.delete(
      '/sessions/:id',
      {
        schema: {
          tags: ['Sessions'],
          summary: 'Soft-delete a single session (hidden from user history; admin still sees it)',
          params: SessionParamSchema,
          response: {
            200: DeleteResponseSchema,
            401: Type.Object({ error: Type.String() }),
            502: Type.Object({ error: Type.String() }),
          },
        },
        preHandler: fastify.verifyAuth,
      },
      async (request, reply) => {
        try {
          await service.deleteSession(request.params.id, request.user!.id);
          return { ok: true };
        } catch (err) {
          request.log.error({ err, session_id: request.params.id }, 'sessions: delete failed');
          return reply.code(502).send({ error: 'Database error' });
        }
      },
    );

    fastify.delete(
      '/sessions',
      {
        schema: {
          tags: ['Sessions'],
          summary: 'Soft-delete ALL sessions for the current user',
          response: {
            200: DeleteResponseSchema,
            401: Type.Object({ error: Type.String() }),
            502: Type.Object({ error: Type.String() }),
          },
        },
        preHandler: fastify.verifyAuth,
      },
      async (request, reply) => {
        try {
          await service.deleteAllSessions(request.user!.id);
          return { ok: true };
        } catch (err) {
          request.log.error({ err }, 'sessions: delete-all failed');
          return reply.code(502).send({ error: 'Database error' });
        }
      },
    );
  };
}
