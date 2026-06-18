import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SessionsRepository } from './sessions.repository.ts';
import { SessionsService } from './sessions.service.ts';
import { makeSessionsController } from './sessions.controller.ts';

export interface SessionsModuleDeps {
  supabase: SupabaseClient;
}

export async function registerSessionsModule(
  fastify: FastifyInstance,
  deps: SessionsModuleDeps,
): Promise<void> {
  const repo = new SessionsRepository(deps.supabase);
  const service = new SessionsService(repo);
  await fastify.register(makeSessionsController(service));
}
