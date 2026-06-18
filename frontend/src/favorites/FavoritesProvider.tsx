import { createContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { deleteJson, getJson, postJson } from '../api';
import type {
  FavoriteAddRequest,
  FavoriteOkResponse,
  FavoritesResponse,
} from '../../../shared/types/favorites.ts';
import { useAuth } from '../auth/useAuth';

interface FavoritesContextValue {
  favorites: Set<string>;
  isFavorite: (symbol: string) => boolean;
  toggle: (symbol: string) => Promise<void>;
  remove: (symbol: string) => Promise<void>;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function normalize(symbol: string): string {
  return symbol.toUpperCase().replace(/USDT$/, '');
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setFavorites(new Set());
      return;
    }

    let cancelled = false;
    setLoading(true);
    getJson<FavoritesResponse>('/favorites')
      .then((res) => {
        if (cancelled) return;
        setFavorites(new Set(res.symbols.map(normalize)));
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('FavoritesProvider: failed to load favorites', err);
        setFavorites(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const isFavorite = useCallback((symbol: string) => favorites.has(normalize(symbol)), [favorites]);

  const add = useCallback(async (raw: string) => {
    const symbol = normalize(raw);
    if (!symbol) return;
    setFavorites((prev) => {
      if (prev.has(symbol)) return prev;
      const next = new Set(prev);
      next.add(symbol);
      return next;
    });
    try {
      await postJson<FavoriteOkResponse, FavoriteAddRequest>('/favorites', { symbol });
    } catch (err) {
      console.warn('FavoritesProvider: add failed, rolling back', err);
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
    }
  }, []);

  const remove = useCallback(async (raw: string) => {
    const symbol = normalize(raw);
    if (!symbol) return;
    let prevSet: Set<string> | null = null;
    setFavorites((prev) => {
      if (!prev.has(symbol)) return prev;
      prevSet = prev;
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
    try {
      await deleteJson<FavoriteOkResponse>(`/favorites/${encodeURIComponent(symbol)}`);
    } catch (err) {
      console.warn('FavoritesProvider: remove failed, rolling back', err);
      if (prevSet) setFavorites(prevSet);
    }
  }, []);

  const toggle = useCallback(async (raw: string) => {
    const symbol = normalize(raw);
    if (favorites.has(symbol)) {
      await remove(symbol);
    } else {
      await add(symbol);
    }
  }, [favorites, add, remove]);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggle, remove, loading }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export { FavoritesContext };
