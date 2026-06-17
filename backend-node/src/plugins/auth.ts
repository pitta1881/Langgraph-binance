import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

async function authPluginFn(fastify: FastifyInstance): Promise<void> {
  fastify.decorate(
    'verifyAuth',
    async function verifyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'unauthenticated' });
      }

      const token = authHeader.slice(7);
      const { data, error } = await fastify.supabase.auth.getUser(token);

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

      const allowed = fastify.config.ADMIN_EMAILS
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (!allowed.includes(request.user!.email)) {
        return reply.code(403).send({ error: 'forbidden' });
      }
    },
  );
}

export const authPlugin = fp(authPluginFn, {
  name: 'auth',
  dependencies: ['supabase-client'],
});

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string };
  }

  interface FastifyInstance {
    verifyAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
