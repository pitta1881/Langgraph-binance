import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';

/**
 * Registers OpenAPI generation + Swagger UI at `/docs`.
 *
 * The spec is derived automatically from each route's TypeBox schema, so this
 * file only carries metadata (title, tags, server URL) and UI behavior.
 *
 * Gated by NODE_ENV: in production the plugins are NOT registered, so `/docs`
 * returns 404 and no spec endpoint exists.
 */
export const swaggerPlugin = fp(async (fastify) => {
  if (fastify.config.NODE_ENV === 'production') {
    fastify.log.info('Swagger disabled in production');
    return;
  }

  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Crypto Dashboard Gateway',
        description:
          'Fastify gateway for the crypto dashboard. Proxies the chat endpoint '
          + 'to the Python LangGraph agent and owns market data (Binance, CoinGecko).',
        version: '0.2.0',
      },
      servers: [
        { url: `http://localhost:${fastify.config.PORT}`, description: 'local dev' },
      ],
      tags: [
        { name: 'Market', description: 'Binance and CoinGecko market data (heatmap, ticker banner, klines, trending).' },
        { name: 'Chat', description: 'Conversational endpoint backed by the LangGraph agent.' },
        { name: 'Favorites', description: 'Per-user favorite coins.' },
        { name: 'Sessions', description: 'Per-user chat history (list and detail).' },
        { name: 'Admin', description: 'Admin-only audit endpoints.' },
        { name: 'System', description: 'Operational endpoints (health, etc).' },
      ],
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  fastify.log.info('Swagger UI available at /docs');
});
