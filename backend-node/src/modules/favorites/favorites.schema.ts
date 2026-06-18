import { Type, type Static } from '@sinclair/typebox';
import type {
  FavoritesResponse as SharedFavoritesResponse,
  FavoriteAddRequest as SharedFavoriteAddRequest,
  FavoriteOkResponse as SharedFavoriteOkResponse,
} from '../../../../shared/types/favorites.ts';

const SymbolPattern = '^[A-Z0-9]{2,10}$';

export const FavoriteSymbolSchema = Type.String({ pattern: SymbolPattern });

export const FavoriteAddRequestSchema = Type.Object({
  symbol: FavoriteSymbolSchema,
});
export type FavoriteAddRequest = Static<typeof FavoriteAddRequestSchema>;
const _addCheck: SharedFavoriteAddRequest = {} as FavoriteAddRequest;
void _addCheck;

export const FavoritesResponseSchema = Type.Object({
  symbols: Type.Array(Type.String()),
});
export type FavoritesResponse = Static<typeof FavoritesResponseSchema>;
const _listCheck: SharedFavoritesResponse = {} as FavoritesResponse;
void _listCheck;

export const FavoriteOkResponseSchema = Type.Object({
  ok: Type.Literal(true),
});
export type FavoriteOkResponse = Static<typeof FavoriteOkResponseSchema>;
const _okCheck: SharedFavoriteOkResponse = {} as FavoriteOkResponse;
void _okCheck;

export const FavoriteParamSchema = Type.Object({
  symbol: FavoriteSymbolSchema,
});
