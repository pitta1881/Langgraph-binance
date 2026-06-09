/**
 * Chat contract — the only endpoint that proxies to the Python agent service.
 *
 * `AgentState` mirrors `agent_service/agents/shared/state.py` ChatState. Every
 * field is optional because the LangGraph pipeline only fills the ones
 * relevant to the intent path it takes. The gateway flattens it down to
 * `ChatResponse` for the browser.
 */

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  response: string;
}

export type AgentIntent =
  | 'price_only'
  | 'analysis'
  | 'market_overview'
  | 'coin_info'
  | 'no_symbol';

export interface AgentState {
  user_message?: string;
  intent?: AgentIntent | string;
  symbol?: string | null;
  coin_info?: string;
  price_context?: string;
  data_valid?: boolean;
  klines_24h?: unknown[];
  klines_7d?: unknown[];
  chart_analysis?: string;
  finance_analysis?: string;
  crypto_analysis?: string;
  response?: string;
}

export interface ChatErrorResponse {
  detail: string;
}
