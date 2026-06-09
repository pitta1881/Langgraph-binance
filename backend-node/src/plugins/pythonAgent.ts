import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { PythonAgentClient } from '../clients/pythonAgent.ts';

async function pythonAgentPlugin(fastify: FastifyInstance): Promise<void> {
  const client = new PythonAgentClient(fastify.config.PYTHON_AGENT_URL, fastify.log);
  fastify.decorate('pythonAgent', client);
}

export const pythonAgentClientPlugin = fp(pythonAgentPlugin, {
  name: 'python-agent-client',
  dependencies: ['@fastify/env'],
});

declare module 'fastify' {
  interface FastifyInstance {
    pythonAgent: PythonAgentClient;
  }
}
