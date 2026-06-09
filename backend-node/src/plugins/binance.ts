import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { BinanceClient } from '../clients/binance.ts';

async function binancePlugin(fastify: FastifyInstance): Promise<void> {
  const client = new BinanceClient(fastify.config.BINANCE_BASE_URL, fastify.log);
  fastify.decorate('binance', client);
}

export const binanceClientPlugin = fp(binancePlugin, {
  name: 'binance-client',
  dependencies: ['@fastify/env'],
});

declare module 'fastify' {
  interface FastifyInstance {
    binance: BinanceClient;
  }
}
