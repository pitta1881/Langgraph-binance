import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChatStubInsert {
  id: string;
  session_id: string;
  user_id: string;
  user_email: string;
  message: string;
  model: string;
}

export interface ChatResultUpdate {
  intent?: string;
  symbol?: string | null;
  response: string;
  latency_ms: number;
}

/**
 * Persistence wrapper around the `chats` table.
 *
 * Two-phase write: we stub the row BEFORE the agent runs so the
 * `node_traces.chat_id` FK is satisfied while the graph fires off traces,
 * then update the same row with the final result.
 */
export class ChatRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async insertStub(stub: ChatStubInsert): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.from('chats').insert(stub);
    return { error: error ? new Error(error.message) : null };
  }

  async updateResult(id: string, update: ChatResultUpdate): Promise<{ error: Error | null }> {
    const { error } = await this.supabase
      .from('chats')
      .update({
        intent: update.intent,
        symbol: update.symbol ?? null,
        response: update.response,
        latency_ms: update.latency_ms,
      })
      .eq('id', id);
    return { error: error ? new Error(error.message) : null };
  }
}
