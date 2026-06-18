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
import { binanceClientPlugin } from './plugins/binance.ts';
import { coingeckoClientPlugin } from './plugins/coingecko.ts';
import { pythonAgentClientPlugin } from './plugins/pythonAgent.ts';
import { supabasePlugin } from './plugins/supabase.ts';
import { authPlugin } from './plugins/auth.ts';
import { swaggerPlugin } from './plugins/swagger.ts';
import { adminRoutes } from './routes/admin.ts';
import { chatRoutes } from './routes/chat.ts';
import { favoritesRoutes } from './routes/favorites.ts';
import { healthRoutes } from './routes/health.ts';
import { heatmapRoutes } from './routes/heatmap.ts';
import { klinesRoutes } from './routes/klines.ts';
import { sessionsRoutes } from './routes/sessions.ts';
import { tickerBannerRoutes } from './routes/tickerBanner.ts';
import { trendingRoutes } from './routes/trending.ts';

/**
 * Boots the Fastify gateway.
 *
 * Order matters: env first (we need PORT/LOG_LEVEL before anything else),
 * then client plugins (they read from fastify.config), then CORS, then routes.
 * Each plugin is awaited so a failure here means the process exits with a
 * non-zero code instead of accepting traffic in a broken state.
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

  // Client plugins — constructed once per app lifetime; visible to all routes
  // because fastify-plugin bypasses Fastify's encapsulation scope.
  await fastify.register(binanceClientPlugin);
  await fastify.register(coingeckoClientPlugin);
  await fastify.register(pythonAgentClientPlugin);
  await fastify.register(supabasePlugin);
  await fastify.register(authPlugin);

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  // Swagger MUST be registered before any route — it hooks into route
  // registration to capture schemas and build the OpenAPI document.
  await fastify.register(swaggerPlugin);

  await fastify.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(heatmapRoutes);
      await api.register(tickerBannerRoutes);
      await api.register(klinesRoutes);
      await api.register(trendingRoutes);
      await api.register(chatRoutes);
      await api.register(favoritesRoutes);
      await api.register(sessionsRoutes);
      await api.register(adminRoutes);
    },
    { prefix: '/api' },
  );

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
