/**
 * Per-user favorite coins. Stored as a flat list of symbols (e.g. "BTC", "ETH")
 * keyed by the authenticated user. The gateway is the only writer; the
 * frontend hits dedicated endpoints rather than Supabase directly.
 */

export interface FavoritesResponse {
  symbols: string[];
}

export interface FavoriteAddRequest {
  symbol: string;
}

export interface FavoriteOkResponse {
  ok: true;
}
