import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import {
  FavoriteAddRequestSchema,
  FavoriteOkResponseSchema,
  FavoriteParamSchema,
  FavoritesResponseSchema,
} from '../schemas/favorites.ts';

export const favoritesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/favorites',
    {
      schema: {
        tags: ['Favorites'],
        summary: 'List the symbols the current user has marked as favorite',
        response: {
          200: FavoritesResponseSchema,
          401: Type.Object({ error: Type.String() }),
          502: Type.Object({ error: Type.String() }),
        },
      },
      preHandler: fastify.verifyAuth,
    },
    async (request, reply) => {
      const { data, error } = await fastify.supabase
        .from('user_favorites')
        .select('symbol')
        .eq('user_id', request.user!.id)
        .order('created_at', { ascending: false });

      if (error) {
        request.log.error({ err: error }, 'favorites: list failed');
        return reply.code(502).send({ error: 'Database error' });
      }

      return { symbols: (data ?? []).map((r) => r.symbol) };
    },
  );

  fastify.post(
    '/favorites',
    {
      schema: {
        tags: ['Favorites'],
        summary: 'Add a coin to the current user\'s favorites (idempotent upsert)',
        body: FavoriteAddRequestSchema,
        response: {
          200: FavoriteOkResponseSchema,
          400: Type.Object({ error: Type.String() }),
          401: Type.Object({ error: Type.String() }),
          502: Type.Object({ error: Type.String() }),
        },
      },
      preHandler: fastify.verifyAuth,
    },
    async (request, reply) => {
      const { symbol } = request.body;

      const { error } = await fastify.supabase
        .from('user_favorites')
        .upsert(
          { user_id: request.user!.id, symbol },
          { onConflict: 'user_id,symbol', ignoreDuplicates: true },
        );

      if (error) {
        request.log.error({ err: error, symbol }, 'favorites: upsert failed');
        return reply.code(502).send({ error: 'Database error' });
      }

      return { ok: true as const };
    },
  );

  fastify.delete(
    '/favorites/:symbol',
    {
      schema: {
        tags: ['Favorites'],
        summary: 'Remove a coin from the current user\'s favorites',
        params: FavoriteParamSchema,
        response: {
          200: FavoriteOkResponseSchema,
          401: Type.Object({ error: Type.String() }),
          502: Type.Object({ error: Type.String() }),
        },
      },
      preHandler: fastify.verifyAuth,
    },
    async (request, reply) => {
      const { symbol } = request.params;

      const { error } = await fastify.supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', request.user!.id)
        .eq('symbol', symbol);

      if (error) {
        request.log.error({ err: error, symbol }, 'favorites: delete failed');
        return reply.code(502).send({ error: 'Database error' });
      }

      return { ok: true as const };
    },
  );
};
