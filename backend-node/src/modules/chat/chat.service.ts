import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { FastifyBaseLogger } from 'fastify';
import type { PythonAgentClient } from '../../shared/infrastructure/pythonAgent.client.ts';
import type { ChatRepository } from './chat.repository.ts';
import type { ChatRequest, ChatResponse } from './chat.schema.ts';

export interface ProcessTurnContext {
  userId: string;
  userEmail: string;
  request: ChatRequest;
  log: FastifyBaseLogger;
}

export class AgentNoResponseError extends Error {
  readonly name = 'AgentNoResponseError' as const;
}

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

export class ChatService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly agent: PythonAgentClient,
  ) {}

  /**
   * Single chat turn lifecycle:
   *  1. Stub `chats` row with id/session/user/message so node_traces FK holds.
   *  2. Call the Python agent.
   *  3. Update the stub with intent/symbol/response/latency.
   * Stub-insert and final-update failures are logged but NOT thrown — they're
   * audit data, not user-blocking.
   */
  async processTurn(ctx: ProcessTurnContext): Promise<ChatResponse> {
    const { userId, userEmail, request, log } = ctx;
    const { message, history, model, session_id } = request;
    const chat_id = randomUUID();
    const resolvedModel = model ?? DEFAULT_MODEL;
    const t0 = performance.now();

    const stub = await this.repo.insertStub({
      id: chat_id,
      session_id,
      user_id: userId,
      user_email: userEmail,
      message,
      model: resolvedModel,
    });
    if (stub.error) {
      log.warn({ err: stub.error, chat_id }, 'chat: failed to persist chat stub');
    }

    const state = await this.agent.runAgent(
      message,
      { history, model, session_id, chat_id },
      log,
    );

    const latency_ms = Math.round(performance.now() - t0);

    log.debug(
      {
        intent: state.intent,
        symbol: state.symbol,
        responseLength: state.response?.length ?? 0,
        latency_ms,
      },
      'chat: agent finished',
    );

    if (!state.response) {
      log.warn({ intent: state.intent, symbol: state.symbol }, 'chat: agent returned no response');
      throw new AgentNoResponseError('Agent returned no response');
    }

    const update = await this.repo.updateResult(chat_id, {
      intent: state.intent,
      symbol: state.symbol ?? null,
      response: state.response,
      latency_ms,
    });
    if (update.error) {
      log.warn({ err: update.error, chat_id }, 'chat: failed to update chat row');
    }

    return {
      response: state.response,
      intent: state.intent,
      symbol: state.symbol ?? null,
    };
  }
}
