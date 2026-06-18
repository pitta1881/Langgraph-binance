import type { FastifyBaseLogger } from 'fastify';
import type { AgentState, ConversationTurn } from '../../../../shared/types/chat.ts';
import { UpstreamParseError } from '../errors/upstream.ts';
import { fetchWithTimeout } from '../http/fetchWithTimeout.ts';
import { AGENT_FETCH_TIMEOUT_MS } from '../constants.ts';

/**
 * HTTP client for the Python LangGraph microservice.
 *
 * Long timeout because the analysis path runs ~5 sequential LLM calls.
 */
export class PythonAgentClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultLog: FastifyBaseLogger,
  ) {}

  async runAgent(
    message: string,
    opts: {
      history?: ConversationTurn[];
      model?: string;
      session_id: string;
      chat_id: string;
    },
    log?: FastifyBaseLogger,
  ): Promise<AgentState> {
    const { history, model, session_id, chat_id } = opts;
    const logger = log ?? this.defaultLog;
    const url = `${this.baseUrl}/run-agent`;
    const historyTurns = history?.length ?? 0;
    logger.debug({ url, message, historyTurns }, 'pythonAgent: dispatching');

    const body: Record<string, unknown> = { message, session_id, chat_id };
    if (history && history.length > 0) body.history = history;
    if (model) body.model = model;

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      AGENT_FETCH_TIMEOUT_MS,
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Python agent ${res.status}: ${errText.slice(0, 200)}`);
    }

    let state: AgentState;
    try {
      state = (await res.json()) as AgentState;
    } catch {
      throw new UpstreamParseError({ url, status: res.status });
    }

    logger.debug({ keys: Object.keys(state) }, 'pythonAgent: state received');
    return state;
  }
}
