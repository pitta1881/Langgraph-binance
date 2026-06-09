import type { FastifyBaseLogger } from 'fastify';
import type { AgentState, ConversationTurn } from '../../../shared/types/chat.ts';
import { UpstreamParseError } from './_errors.ts';
import { fetchWithTimeout } from './_fetch.ts';
import { AGENT_FETCH_TIMEOUT_MS } from '../constants.ts';

/**
 * HTTP client for the Python LangGraph microservice.
 *
 * Lives on a separate port and is the only consumer of Gemini in the system.
 * Long timeout because the agent makes 5 sequential LLM calls in the analysis
 * path (intent_router → chart_analyst → finance_expert → crypto_expert →
 * reviewer) and each one can take a few seconds.
 */
export class PythonAgentClient {
  private readonly log: FastifyBaseLogger;

  constructor(
    private readonly baseUrl: string,
    log: FastifyBaseLogger,
  ) {
    this.log = log;
  }

  async runAgent(
    message: string,
    history?: ConversationTurn[],
    log?: FastifyBaseLogger,
  ): Promise<AgentState> {
    const logger = log ?? this.log;
    const url = `${this.baseUrl}/run-agent`;
    const historyTurns = history?.length ?? 0;
    logger.debug({ url, message, historyTurns }, 'pythonAgent: dispatching');

    const body = history && history.length > 0
      ? { message, history }
      : { message };

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
      const body = await res.text();
      throw new Error(`Python agent ${res.status}: ${body.slice(0, 200)}`);
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
