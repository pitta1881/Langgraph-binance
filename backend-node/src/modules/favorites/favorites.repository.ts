import type { SupabaseClient } from '@supabase/supabase-js';

export class FavoritesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByUser(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_favorites')
      .select('symbol')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.symbol);
  }

  async upsert(userId: string, symbol: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_favorites')
      .upsert(
        { user_id: userId, symbol },
        { onConflict: 'user_id,symbol', ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  }

  async delete(userId: string, symbol: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol);
    if (error) throw new Error(error.message);
  }
}
