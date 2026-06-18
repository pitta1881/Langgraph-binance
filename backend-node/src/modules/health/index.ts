import type { FastifyInstance } from 'fastify';
import { healthController } from './health.controller.ts';

/**
 * Health module — has no business logic, so the controller is registered
 * directly. Kept as a registerXModule function for consistency with the other
 * modules.
 */
export async function registerHealthModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthController);
}
