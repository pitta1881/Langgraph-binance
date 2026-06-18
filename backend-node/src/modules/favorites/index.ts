import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FavoritesRepository } from './favorites.repository.ts';
import { FavoritesService } from './favorites.service.ts';
import { makeFavoritesController } from './favorites.controller.ts';

export interface FavoritesModuleDeps {
  supabase: SupabaseClient;
}

export async function registerFavoritesModule(
  fastify: FastifyInstance,
  deps: FavoritesModuleDeps,
): Promise<void> {
  const repo = new FavoritesRepository(deps.supabase);
  const service = new FavoritesService(repo);
  await fastify.register(makeFavoritesController(service));
}
