import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import {
  type TypeBoxTypeProvider,
  TypeBoxValidatorCompiler,
} from '@fastify/type-provider-typebox';

import { ConfigSchema } from './config.ts';
import { authPlugin } from './shared/plugins/auth.ts';
import { swaggerPlugin } from './shared/plugins/swagger.ts';
import { createSupabaseClient } from './shared/infrastructure/supabase.client.ts';
import { BinanceClient } from './shared/infrastructure/binance.client.ts';
import { CoingeckoClient } from './shared/infrastructure/coingecko.client.ts';
import { PythonAgentClient } from './shared/infrastructure/pythonAgent.client.ts';
import { registerHealthModule } from './modules/health/index.ts';
import { registerMarketModule } from './modules/market/index.ts';
import { registerChatModule } from './modules/chat/index.ts';
import { registerFavoritesModule } from './modules/favorites/index.ts';
import { registerSessionsModule } from './modules/sessions/index.ts';
import { registerAdminModule } from './modules/admin/index.ts';

/**
 * Boots the Fastify gateway.
 *
 * Bootstrap order:
 *   1. Env + CORS + TypeBox.
 *   2. Instantiate infrastructure (Supabase + external HTTP clients) ONCE,
 *      passing them around via DI.
 *   3. Register cross-cutting plugins (auth, swagger). Auth receives the
 *      Supabase client through its options — no decorators on fastify for
 *      external systems.
 *   4. Register one module per feature under `/api`. Each module wires its
 *      own controller → service → repository graph.
 *   5. In production: static SPA + a notFoundHandler that distinguishes
 *      `/api/*` (JSON 404) from SPA paths (index.html fallback).
 */
async function buildServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const transport = isDev
    ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss',
          colorize: true,
          ignore: 'pid,hostname',
        },
      }
    : undefined;

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  fastify.setValidatorCompiler(TypeBoxValidatorCompiler);

  await fastify.register(fastifyEnv, {
    schema: ConfigSchema,
    dotenv: true,
    confKey: 'config',
  });

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  // 2 — Infrastructure singletons. Injected by value into each module.
  const supabase = createSupabaseClient(fastify.config);
  const binance = new BinanceClient(fastify.config.BINANCE_BASE_URL, fastify.log);
  const coingecko = new CoingeckoClient(
    fastify.config.COINGECKO_BASE_URL,
    fastify.config.COINGECKO_API_KEY,
    fastify.log,
  );
  const pythonAgent = new PythonAgentClient(fastify.config.PYTHON_AGENT_URL, fastify.log);

  // 3 — Cross-cutting Fastify plugins (decorate request/instance).
  const adminEmails = fastify.config.ADMIN_EMAILS
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await fastify.register(authPlugin, { supabase, adminEmails });
  await fastify.register(swaggerPlugin);

  // 4 — Feature modules under /api.
  await fastify.register(
    async (api) => {
      await registerHealthModule(api);
      await registerMarketModule(api, { binance, coingecko });
      await registerChatModule(api, { supabase, pythonAgent });
      await registerFavoritesModule(api, { supabase });
      await registerSessionsModule(api, { supabase });
      await registerAdminModule(api, { supabase });
    },
    { prefix: '/api' },
  );

  // 5 — SPA static + 404 fallback (production only).
  if (!isDev) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const staticRoot = path.join(__dirname, '..', 'public');

    await fastify.register(fastifyStatic, {
      root: staticRoot,
      prefix: '/',
      wildcard: false,
    });

    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html', staticRoot);
    });
  }

  return fastify;
}

const fastify = await buildServer();

try {
  await fastify.listen({ port: fastify.config.PORT, host: fastify.config.HOST });
  fastify.log.info(
    { port: fastify.config.PORT, pythonAgent: fastify.config.PYTHON_AGENT_URL },
    'Gateway ready',
  );
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
