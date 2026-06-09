import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifyCors from '@fastify/cors';
import {
  type TypeBoxTypeProvider,
  TypeBoxValidatorCompiler,
} from '@fastify/type-provider-typebox';

import { ConfigSchema, type Config } from './config.ts';
import { chatRoutes } from './routes/chat.ts';
import { healthRoutes } from './routes/health.ts';
import { heatmapRoutes } from './routes/heatmap.ts';
import { klinesRoutes } from './routes/klines.ts';
import { tickerBannerRoutes } from './routes/tickerBanner.ts';
import { trendingRoutes } from './routes/trending.ts';

/**
 * Boots the Fastify gateway.
 *
 * Order matters: env first (we need PORT/LOG_LEVEL before anything else),
 * then CORS, then routes. Each plugin is awaited so a failure here means the
 * process exits with a non-zero code instead of accepting traffic in a broken
 * state.
 */
async function buildServer() {
  // Pino formatting: pretty in dev so logs are readable in the terminal,
  // raw JSON in prod for log aggregators.
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

  await fastify.register(healthRoutes);
  await fastify.register(heatmapRoutes);
  await fastify.register(tickerBannerRoutes);
  await fastify.register(klinesRoutes);
  await fastify.register(trendingRoutes);
  await fastify.register(chatRoutes);

  return fastify;
}

const fastify = await buildServer();
const config = fastify.config as Config;

try {
  await fastify.listen({ port: config.PORT, host: config.HOST });
  fastify.log.info(
    { port: config.PORT, pythonAgent: config.PYTHON_AGENT_URL },
    'Gateway ready',
  );
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
