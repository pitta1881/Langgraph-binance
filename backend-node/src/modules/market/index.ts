import type { FastifyInstance } from 'fastify';
import type { BinanceClient } from '../../shared/infrastructure/binance.client.ts';
import type { CoingeckoClient } from '../../shared/infrastructure/coingecko.client.ts';
import { MarketService } from './market.service.ts';
import { makeMarketController } from './market.controller.ts';

export interface MarketModuleDeps {
  binance: BinanceClient;
  coingecko: CoingeckoClient;
}

export async function registerMarketModule(
  fastify: FastifyInstance,
  deps: MarketModuleDeps,
): Promise<void> {
  const service = new MarketService(deps.binance, deps.coingecko);
  await fastify.register(makeMarketController(service));
}
