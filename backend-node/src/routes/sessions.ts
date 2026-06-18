import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import {
  SessionMessagesResponseSchema,
  SessionParamSchema,
  SessionsResponseSchema,
} from '../schemas/sessions.ts';

const FIRST_MESSAGE_MAX_LEN = 60;
const MAX_SESSIONS = 50;
const ROW_FETCH_LIMIT = 500;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export const sessionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
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
      // chats_user_created_idx covers (user_id, created_at desc).
      const { data, error } = await fastify.supabase
        .from('chats')
        .select('session_id, message, created_at')
        .eq('user_id', request.user!.id)
        .order('created_at', { ascending: false })
        .limit(ROW_FETCH_LIMIT);

      if (error) {
        request.log.error({ err: error }, 'sessions: list failed');
        return reply.code(502).send({ error: 'Database error' });
      }

      const map = new Map<string, {
        first_message: string;
        first_at: string;
        started_at: string;
        ended_at: string;
        message_count: number;
      }>();

      for (const row of (data ?? [])) {
        const existing = map.get(row.session_id);
        if (!existing) {
          map.set(row.session_id, {
            first_message: row.message,
            first_at: row.created_at,
            started_at: row.created_at,
            ended_at: row.created_at,
            message_count: 1,
          });
          continue;
        }
        existing.message_count += 1;
        if (row.created_at < existing.started_at) existing.started_at = row.created_at;
        if (row.created_at > existing.ended_at) existing.ended_at = row.created_at;
        // Keep the oldest message in the group as label.
        if (row.created_at < existing.first_at) {
          existing.first_at = row.created_at;
          existing.first_message = row.message;
        }
      }

      const sessions = Array.from(map.entries())
        .map(([session_id, v]) => ({
          session_id,
          first_message: truncate(v.first_message, FIRST_MESSAGE_MAX_LEN),
          started_at: v.started_at,
          ended_at: v.ended_at,
          message_count: v.message_count,
        }))
        .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
        .slice(0, MAX_SESSIONS);

      return sessions;
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
      const { id } = request.params;

      // Double filter prevents cross-user access even if a session_id leaks.
      const { data, error } = await fastify.supabase
        .from('chats')
        .select('id, message, response, symbol, intent, created_at')
        .eq('session_id', id)
        .eq('user_id', request.user!.id)
        .order('created_at');

      if (error) {
        request.log.error({ err: error, session_id: id }, 'sessions: messages query failed');
        return reply.code(502).send({ error: 'Database error' });
      }

      return data ?? [];
    },
  );
};
