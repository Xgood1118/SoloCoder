import { LRUCache } from './lru-cache';

export class SearchCache {
  private cache: LRUCache<string, any>;
  private capacity: number;

  constructor(capacity?: number, ttl?: number) {
    this.capacity = capacity ?? 100;
    this.cache = new LRUCache<string, any>(this.capacity, ttl);
  }

  buildKey(query: string, options?: object): string {
    return JSON.stringify({ query, options });
  }

  get(query: string, options?: object): any | null {
    const key = this.buildKey(query, options);
    return this.cache.get(key);
  }

  set(query: string, value: any, options?: object): void {
    const key = this.buildKey(query, options);
    this.cache.set(key, value);
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      const parsed = JSON.parse(key);
      if (parsed.query.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  getStats(): { size: number; capacity: number; hitRate: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      hitRate: this.cache.hitRate,
      hits: this.cache.hitsCount,
      misses: this.cache.missesCount,
    };
  }
}
