import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { CoingeckoClient } from '../clients/coingecko.ts';

async function coingeckoPlugin(fastify: FastifyInstance): Promise<void> {
  const client = new CoingeckoClient(
    fastify.config.COINGECKO_BASE_URL,
    fastify.config.COINGECKO_API_KEY,
    fastify.log,
  );
  fastify.decorate('coingecko', client);
}

export const coingeckoClientPlugin = fp(coingeckoPlugin, {
  name: 'coingecko-client',
  dependencies: ['@fastify/env'],
});

declare module 'fastify' {
  interface FastifyInstance {
    coingecko: CoingeckoClient;
  }
}
