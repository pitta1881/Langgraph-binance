import type { SupabaseClient } from '@supabase/supabase-js';
import type { Static } from '@sinclair/typebox';
import type { ChatRowSchema, TraceRowSchema } from './admin.schema.ts';

export type ChatRow = Static<typeof ChatRowSchema>;
export type TraceRow = Static<typeof TraceRowSchema>;

export interface ChatSummaryRow {
  session_id: string;
  user_email: string;
  created_at: string;
  intent: string | null;
}

const SESSION_FETCH_LIMIT = 1000;

export class AdminRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listRecentChatSummaries(): Promise<ChatSummaryRow[]> {
    const { data, error } = await this.supabase
      .from('chats')
      .select('session_id, user_email, created_at, intent')
      .order('created_at', { ascending: false })
      .limit(SESSION_FETCH_LIMIT);
    if (error) throw new Error(error.message);
    return (data ?? []) as ChatSummaryRow[];
  }

  async listSessionChats(sessionId: string): Promise<ChatRow[]> {
    const { data, error } = await this.supabase
      .from('chats')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []) as ChatRow[];
  }

  async listChatTraces(chatId: string): Promise<TraceRow[]> {
    const { data, error } = await this.supabase
      .from('node_traces')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []) as TraceRow[];
  }
}
