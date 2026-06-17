-- Schema for chat audit. Run this once in the Supabase SQL Editor.
-- Auth users live in auth.users (managed by Supabase Auth).

-- 1 row per user message turn.
create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  message text not null,
  model text not null,
  intent text,
  symbol text,
  response text,
  latency_ms int,
  created_at timestamptz not null default now()
);

-- 1 row per LLM call inside a node.
create table if not exists node_traces (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  node_name text not null,
  model text not null,
  prompt_system text,
  prompt_user text,
  response text,
  latency_ms int,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists chats_user_created_idx on chats(user_id, created_at desc);
create index if not exists chats_session_idx on chats(session_id);
create index if not exists node_traces_chat_idx on node_traces(chat_id);
create index if not exists node_traces_chat_created_idx on node_traces(chat_id, created_at);

-- RLS stays OFF on these tables: only the service_role key (used by gateway
-- and agent service) writes; the admin dashboard reads via the gateway, which
-- gates access with ADMIN_EMAILS. Frontend never queries these directly.
alter table chats disable row level security;
alter table node_traces disable row level security;
