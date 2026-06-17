import { Type, type Static } from '@sinclair/typebox';
import type {
  ChatRequest as SharedChatRequest,
  ChatResponse as SharedChatResponse,
  AgentState as SharedAgentState,
  ConversationTurn as SharedConversationTurn,
} from '../../../shared/types/chat.ts';

export const ConversationTurnSchema = Type.Object({
  role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
  content: Type.Optional(Type.String()),
  symbol: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  intent: Type.Optional(Type.String()),
});
export type ConversationTurn = Static<typeof ConversationTurnSchema>;
const _turnCheck: SharedConversationTurn = {} as ConversationTurn;
void _turnCheck;

export const ChatRequestSchema = Type.Object({
  message: Type.String({ minLength: 1 }),
  history: Type.Optional(Type.Array(ConversationTurnSchema, { maxItems: 10 })),
  model: Type.Optional(Type.Union([
    Type.Literal('gemini-3.1-flash-lite'),
    Type.Literal('gemini-2.0-flash'),
    Type.Literal('gemini-1.5-flash'),
    Type.Literal('gemini-1.5-pro'),
    Type.Literal('gemini-2.0-flash-exp'),
  ])),
  session_id: Type.String({
    pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  }),
});
export type ChatRequest = Static<typeof ChatRequestSchema>;
const _chatRequestCheck: SharedChatRequest = {} as ChatRequest;
void _chatRequestCheck;

export const ChatResponseSchema = Type.Object({
  response: Type.String(),
  intent: Type.Optional(Type.String()),
  symbol: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});
export type ChatResponse = Static<typeof ChatResponseSchema>;
const _chatResponseCheck: SharedChatResponse = {} as ChatResponse;
void _chatResponseCheck;

/**
 * Full ChatState the Python agent returns.
 *
 * Mirrors `agent_service/agents/shared/state.py` — every field is optional
 * because the agent only fills the ones relevant to each intent path.
 * The gateway flattens this to `{ response }` for the frontend, but logging
 * the full state on debug is gold for troubleshooting agent behavior.
 */
export const AgentStateSchema = Type.Object({
  user_message: Type.Optional(Type.String()),
  intent: Type.Optional(Type.String()),
  symbol: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  coin_info: Type.Optional(Type.String()),
  price_context: Type.Optional(Type.String()),
  data_valid: Type.Optional(Type.Boolean()),
  klines_24h: Type.Optional(Type.Array(Type.Unknown())),
  klines_7d: Type.Optional(Type.Array(Type.Unknown())),
  chart_analysis: Type.Optional(Type.String()),
  finance_analysis: Type.Optional(Type.String()),
  crypto_analysis: Type.Optional(Type.String()),
  response: Type.Optional(Type.String()),
});
export type AgentState = Static<typeof AgentStateSchema>;
const _agentStateCheck: SharedAgentState = {} as AgentState;
void _agentStateCheck;
