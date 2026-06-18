import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import {
  AdminSessionSchema,
  ChatRowSchema,
  IdParamSchema,
  TraceRowSchema,
} from './admin.schema.ts';
import type { AdminService } from './admin.service.ts';

export function makeAdminController(service: AdminService): FastifyPluginAsyncTypebox {
  return async (fastify) => {
    fastify.get(
      '/admin/sessions',
      {
        schema: {
          tags: ['Admin'],
          summary: 'List recent sessions grouped by session_id',
          response: {
            200: Type.Array(AdminSessionSchema),
            401: Type.Object({ error: Type.String() }),
            403: Type.Object({ error: Type.String() }),
            502: Type.Object({ error: Type.String() }),
          },
        },
        preHandler: fastify.verifyAdmin,
      },
      async (request, reply) => {
        try {
          return await service.listSessions();
        } catch (err) {
          request.log.error({ err }, 'admin/sessions: db error');
          return reply.code(502).send({ error: 'Database error' });
        }
      },
    );

    fastify.get(
      '/admin/sessions/:id/chats',
      {
        schema: {
          tags: ['Admin'],
          summary: 'List all chats in a session',
          params: IdParamSchema,
          response: {
            200: Type.Array(ChatRowSchema),
            401: Type.Object({ error: Type.String() }),
            403: Type.Object({ error: Type.String() }),
            502: Type.Object({ error: Type.String() }),
          },
        },
        preHandler: fastify.verifyAdmin,
      },
      async (request, reply) => {
        try {
          return await service.listSessionChats(request.params.id);
        } catch (err) {
          request.log.error({ err }, 'admin/sessions/:id/chats: db error');
          return reply.code(502).send({ error: 'Database error' });
        }
      },
    );

    fastify.get(
      '/admin/chats/:id/traces',
      {
        schema: {
          tags: ['Admin'],
          summary: 'List all node traces for a chat',
          params: IdParamSchema,
          response: {
            200: Type.Array(TraceRowSchema),
            401: Type.Object({ error: Type.String() }),
            403: Type.Object({ error: Type.String() }),
            502: Type.Object({ error: Type.String() }),
          },
        },
        preHandler: fastify.verifyAdmin,
      },
      async (request, reply) => {
        try {
          return await service.listChatTraces(request.params.id);
        } catch (err) {
          request.log.error({ err }, 'admin/chats/:id/traces: db error');
          return reply.code(502).send({ error: 'Database error' });
        }
      },
    );
  };
}
