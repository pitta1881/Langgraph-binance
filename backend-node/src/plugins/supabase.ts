import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

async function supabasePluginFn(fastify: FastifyInstance): Promise<void> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = fastify.config;

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  fastify.decorate('supabase', client);
}

export const supabasePlugin = fp(supabasePluginFn, {
  name: 'supabase-client',
  dependencies: ['@fastify/env'],
});

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}
