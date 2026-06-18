import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import {
  FavoriteAddRequestSchema,
  FavoriteOkResponseSchema,
  FavoriteParamSchema,
  FavoritesResponseSchema,
} from './favorites.schema.ts';
import type { FavoritesService } from './favorites.service.ts';

export function makeFavoritesController(service: FavoritesService): FastifyPluginAsyncTypebox {
  return async (fastify) => {
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
        try {
          return await service.list(request.user!.id);
        } catch (err) {
          request.log.error({ err }, 'favorites: list failed');
          return reply.code(502).send({ error: 'Database error' });
        }
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
        try {
          await service.add(request.user!.id, request.body.symbol);
          return { ok: true as const };
        } catch (err) {
          request.log.error({ err, symbol: request.body.symbol }, 'favorites: upsert failed');
          return reply.code(502).send({ error: 'Database error' });
        }
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
        try {
          await service.remove(request.user!.id, request.params.symbol);
          return { ok: true as const };
        } catch (err) {
          request.log.error({ err, symbol: request.params.symbol }, 'favorites: delete failed');
          return reply.code(502).send({ error: 'Database error' });
        }
      },
    );
  };
}
