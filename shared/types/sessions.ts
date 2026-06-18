/**
 * User-facing chat history. A "session" is a group of `chats` rows sharing
 * the same `session_id`. The label shown in the sidebar is derived from the
 * first user message of the group — we don't store a separate title column.
 */

import type { AgentIntent } from './chat.ts';

export interface ChatSession {
  session_id: string;
  first_message: string;
  started_at: string;
  ended_at: string;
  message_count: number;
}

export interface SessionMessage {
  id: string;
  message: string;
  response: string | null;
  symbol: string | null;
  intent: AgentIntent | string | null;
  created_at: string;
}

export type SessionsResponse = ChatSession[];
export type SessionMessagesResponse = SessionMessage[];
