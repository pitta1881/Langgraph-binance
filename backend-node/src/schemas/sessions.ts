import { Type, type Static } from '@sinclair/typebox';
import type {
  ChatSession as SharedChatSession,
  SessionMessage as SharedSessionMessage,
} from '../../../shared/types/sessions.ts';

export const ChatSessionSchema = Type.Object({
  session_id: Type.String(),
  first_message: Type.String(),
  started_at: Type.String(),
  ended_at: Type.String(),
  message_count: Type.Number(),
});
export type ChatSession = Static<typeof ChatSessionSchema>;
const _sessionCheck: SharedChatSession = {} as ChatSession;
void _sessionCheck;

export const SessionMessageSchema = Type.Object({
  id: Type.String(),
  message: Type.String(),
  response: Type.Union([Type.String(), Type.Null()]),
  symbol: Type.Union([Type.String(), Type.Null()]),
  intent: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type SessionMessage = Static<typeof SessionMessageSchema>;
const _msgCheck: SharedSessionMessage = {} as SessionMessage;
void _msgCheck;

export const SessionsResponseSchema = Type.Array(ChatSessionSchema);
export const SessionMessagesResponseSchema = Type.Array(SessionMessageSchema);

export const SessionParamSchema = Type.Object({
  id: Type.String({
    pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  }),
});
