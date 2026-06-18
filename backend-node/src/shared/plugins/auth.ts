import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Decorates `fastify.verifyAuth` and `fastify.verifyAdmin` preHandlers.
 *
 * Kept as a Fastify plugin (and not pure DI) because `verifyAuth` is consumed
 * via Fastify's route-level `preHandler` mechanism, which expects a function
 * already bound on the instance. The Supabase client is injected via plugin
 * options instead of being read from a decorator, keeping the module boundary
 * explicit.
 */
export interface AuthPluginOptions {
  supabase: SupabaseClient;
  adminEmails: string[];
}

async function authPluginFn(
  fastify: FastifyInstance,
  opts: AuthPluginOptions,
): Promise<void> {
  const { supabase, adminEmails } = opts;
  const allowed = new Set(adminEmails);

  fastify.decorate(
    'verifyAuth',
    async function verifyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'unauthenticated' });
      }

      const token = authHeader.slice(7);
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        return reply.code(401).send({ error: 'unauthenticated' });
      }

      request.user = { id: data.user.id, email: data.user.email ?? '' };
    },
  );

  fastify.decorate(
    'verifyAdmin',
    async function verifyAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await fastify.verifyAuth(request, reply);
      if (reply.sent) return;

      if (!allowed.has(request.user!.email)) {
        return reply.code(403).send({ error: 'forbidden' });
      }
    },
  );
}

export const authPlugin = fp(authPluginFn, { name: 'auth' });

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string };
  }

  interface FastifyInstance {
    verifyAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
