import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

export const adminRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const AdminSessionSchema = Type.Object({
    session_id: Type.String(),
    user_email: Type.String(),
    started_at: Type.String(),
    ended_at: Type.String(),
    message_count: Type.Number(),
  });

  const ChatRowSchema = Type.Object({
    id: Type.String(),
    session_id: Type.String(),
    user_id: Type.String(),
    user_email: Type.String(),
    message: Type.String(),
    model: Type.String(),
    intent: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    symbol: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    response: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    latency_ms: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    created_at: Type.String(),
  });

  const TraceRowSchema = Type.Object({
    id: Type.String(),
    chat_id: Type.String(),
    node_name: Type.String(),
    model: Type.String(),
    prompt_system: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    prompt_user: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    response: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    latency_ms: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    error: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    created_at: Type.String(),
  });

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
      const { data, error } = await fastify.supabase
        .from('chats')
        .select('session_id, user_email, created_at, intent')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        request.log.error({ err: error }, 'admin/sessions: db error');
        return reply.code(502).send({ error: 'Database error' });
      }

      const sessionMap = new Map<string, {
        user_email: string;
        started_at: string;
        ended_at: string;
        message_count: number;
      }>();

      for (const row of (data ?? [])) {
        const existing = sessionMap.get(row.session_id);
        if (!existing) {
          sessionMap.set(row.session_id, {
            user_email: row.user_email,
            started_at: row.created_at,
            ended_at: row.created_at,
            message_count: 1,
          });
        } else {
          if (row.created_at < existing.started_at) existing.started_at = row.created_at;
          if (row.created_at > existing.ended_at) existing.ended_at = row.created_at;
          existing.message_count += 1;
        }
      }

      const sessions = Array.from(sessionMap.entries())
        .map(([session_id, v]) => ({ session_id, ...v }))
        .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
        .slice(0, 100);

      return sessions;
    },
  );

  fastify.get(
    '/admin/sessions/:id/chats',
    {
      schema: {
        tags: ['Admin'],
        summary: 'List all chats in a session',
        params: Type.Object({ id: Type.String() }),
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
      const { id } = request.params;
      const { data, error } = await fastify.supabase
        .from('chats')
        .select('*')
        .eq('session_id', id)
        .order('created_at');

      if (error) {
        request.log.error({ err: error }, 'admin/sessions/:id/chats: db error');
        return reply.code(502).send({ error: 'Database error' });
      }

      return data ?? [];
    },
  );

  fastify.get(
    '/admin/chats/:id/traces',
    {
      schema: {
        tags: ['Admin'],
        summary: 'List all node traces for a chat',
        params: Type.Object({ id: Type.String() }),
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
      const { id } = request.params;
      const { data, error } = await fastify.supabase
        .from('node_traces')
        .select('*')
        .eq('chat_id', id)
        .order('created_at');

      if (error) {
        request.log.error({ err: error }, 'admin/chats/:id/traces: db error');
        return reply.code(502).send({ error: 'Database error' });
      }

      return data ?? [];
    },
  );
};
