import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionMessage } from './sessions.schema.ts';

export interface ChatRowForListing {
  session_id: string;
  message: string;
  created_at: string;
}

const ROW_FETCH_LIMIT = 500;

export class SessionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Returns the latest N rows for the user, ordered by created_at desc.
   * The service does the grouping by session_id in memory; doing it in SQL would
   * require a window function and Supabase's PostgREST doesn't expose them.
   */
  async listRecentChatsForUser(userId: string): Promise<ChatRowForListing[]> {
    const { data, error } = await this.supabase
      .from('chats')
      .select('session_id, message, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(ROW_FETCH_LIMIT);
    if (error) throw new Error(error.message);
    return (data ?? []) as ChatRowForListing[];
  }

  /**
   * Fetches the messages of a single session, double-filtered by user_id to
   * prevent cross-user access even if a session_id leaks.
   */
  async listSessionMessages(sessionId: string, userId: string): Promise<SessionMessage[]> {
    const { data, error } = await this.supabase
      .from('chats')
      .select('id, message, response, symbol, intent, created_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []) as SessionMessage[];
  }

  /**
   * Soft-deletes all chats belonging to a single session for the given user.
   * Double-filtered by user_id so a leaked session_id cannot touch another user's data.
   */
  async softDeleteSession(userId: string, sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('chats')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
  }

  /** Soft-deletes ALL non-deleted chats for the given user. */
  async softDeleteAllForUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('chats')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
  }
}
