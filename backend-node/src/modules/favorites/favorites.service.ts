import type { FavoritesRepository } from './favorites.repository.ts';
import type { FavoritesResponse } from './favorites.schema.ts';

export class FavoritesService {
  constructor(private readonly repo: FavoritesRepository) {}

  async list(userId: string): Promise<FavoritesResponse> {
    const symbols = await this.repo.listByUser(userId);
    return { symbols };
  }

  add(userId: string, symbol: string): Promise<void> {
    return this.repo.upsert(userId, symbol);
  }

  remove(userId: string, symbol: string): Promise<void> {
    return this.repo.delete(userId, symbol);
  }
}
