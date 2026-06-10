/**
 * Chat contract — the only endpoint that proxies to the Python agent service.
 *
 * `AgentState` mirrors `agent_service/agents/shared/state.py` ChatState. Every
 * field is optional because the LangGraph pipeline only fills the ones
 * relevant to the intent path it takes. The gateway flattens it down to
 * `ChatResponse` for the browser.
 */

export type AgentIntent =
  | 'price_only'
  | 'analysis'
  | 'market_overview'
  | 'coin_info'
  | 'no_symbol'
  | 'off_topic';

/**
 * One compact entry in the rolling conversation history.
 *
 * For `role: 'user'` we send the raw text in `content`. For `role: 'assistant'`
 * we omit `content` and only send what the intent_router actually needs to
 * resolve implicit references: the symbol and the intent of the previous turn.
 * This keeps the prompt cheap (under a few KB even with 20 turns).
 */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content?: string;
  symbol?: string | null;
  intent?: AgentIntent | string;
}

export interface ChatRequest {
  message: string;
  /** Oldest first. Up to 20 entries. Omit on first turn. */
  history?: ConversationTurn[];
}

export interface ChatResponse {
  response: string;
  /** Exposed so the frontend can stash it on the assistant message and feed it back as history on the next request. */
  intent?: AgentIntent | string;
  symbol?: string | null;
}

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
  history?: ConversationTurn[];
}

export interface ChatErrorResponse {
  detail: string;
}
