import { Type, type Static } from '@sinclair/typebox';

/**
 * Runtime configuration schema.
 *
 * Validated by @fastify/env at startup. Missing required vars crash the server
 * before any request can hit a half-configured handler — that's the contract.
 */
export const ConfigSchema = Type.Object({
  PORT: Type.Number({ default: 8000 }),
  HOST: Type.String({ default: '0.0.0.0' }),
  LOG_LEVEL: Type.String({ default: 'info' }),
  NODE_ENV: Type.String({ default: 'development' }),
  PYTHON_AGENT_URL: Type.String({ default: 'http://localhost:8001' }),
  BINANCE_BASE_URL: Type.String({ default: 'https://api.binance.com' }),
  COINGECKO_BASE_URL: Type.String({ default: 'https://api.coingecko.com' }),
  COINGECKO_API_KEY: Type.String({ default: '' }),
});

export type Config = Static<typeof ConfigSchema>;

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}
