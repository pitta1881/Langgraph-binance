import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from '../../config.ts';

/**
 * Service-role Supabase client.
 *
 * Bypasses RLS — only used by the gateway, never exposed to the browser.
 * Sessions are disabled because the gateway is stateless and validates JWTs
 * per request via `supabase.auth.getUser(token)` in the auth plugin.
 */
export function createSupabaseClient(config: Config): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
