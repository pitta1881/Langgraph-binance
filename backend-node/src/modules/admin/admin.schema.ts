import { Type } from '@sinclair/typebox';

export const AdminSessionSchema = Type.Object({
  session_id: Type.String(),
  user_email: Type.String(),
  started_at: Type.String(),
  ended_at: Type.String(),
  message_count: Type.Number(),
  deleted: Type.Boolean(),
  deleted_at: Type.Union([Type.String(), Type.Null()]),
});

export const ChatRowSchema = Type.Object({
  id: Type.String(),
  session_id: Type.String(),
  user_id: Type.String(),
  user_email: Type.String(),
  message: Type.String(),
  model: Type.String(),
  intent: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  symbol: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  response: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  latency_ms: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  created_at: Type.String(),
});

export const TraceRowSchema = Type.Object({
  id: Type.String(),
  chat_id: Type.String(),
  node_name: Type.String(),
  model: Type.String(),
  prompt_system: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  prompt_user: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  response: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  latency_ms: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  error: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  created_at: Type.String(),
});

export const IdParamSchema = Type.Object({ id: Type.String() });
