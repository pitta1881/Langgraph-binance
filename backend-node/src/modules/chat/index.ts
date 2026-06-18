import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PythonAgentClient } from '../../shared/infrastructure/pythonAgent.client.ts';
import { ChatRepository } from './chat.repository.ts';
import { ChatService } from './chat.service.ts';
import { makeChatController } from './chat.controller.ts';

export interface ChatModuleDeps {
  supabase: SupabaseClient;
  pythonAgent: PythonAgentClient;
}

export async function registerChatModule(
  fastify: FastifyInstance,
  deps: ChatModuleDeps,
): Promise<void> {
  const repo = new ChatRepository(deps.supabase);
  const service = new ChatService(repo, deps.pythonAgent);
  await fastify.register(makeChatController(service));
}
