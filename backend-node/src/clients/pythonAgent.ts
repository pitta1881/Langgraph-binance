import type { FastifyBaseLogger } from 'fastify';
import type { AgentState } from '../schemas/chat.ts';

/**
 * HTTP client for the Python LangGraph microservice.
 *
 * Lives on a separate port and is the only consumer of Gemini in the system.
 * Long timeout because the agent makes 5 sequential LLM calls in the analysis
 * path (intent_router → chart_analyst → finance_expert → crypto_expert →
 * reviewer) and each one can take a few seconds.
 */
export class PythonAgentClient {
  constructor(
    private readonly baseUrl: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  async runAgent(message: string): Promise<AgentState> {
    const url = `${this.baseUrl}/run-agent`;
    this.log.debug({ url, message }, 'pythonAgent: dispatching');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Python agent ${res.status}: ${body.slice(0, 200)}`);
      }

      const state = (await res.json()) as AgentState;
      this.log.debug({ keys: Object.keys(state) }, 'pythonAgent: state received');
      return state;
    } finally {
      clearTimeout(timeout);
    }
  }
}
