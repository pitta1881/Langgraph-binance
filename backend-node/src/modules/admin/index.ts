import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminRepository } from './admin.repository.ts';
import { AdminService } from './admin.service.ts';
import { makeAdminController } from './admin.controller.ts';

export interface AdminModuleDeps {
  supabase: SupabaseClient;
}

export async function registerAdminModule(
  fastify: FastifyInstance,
  deps: AdminModuleDeps,
): Promise<void> {
  const repo = new AdminRepository(deps.supabase);
  const service = new AdminService(repo);
  await fastify.register(makeAdminController(service));
}
