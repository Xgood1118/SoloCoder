interface CacheEntry<V> {
  value: V;
  timer?: any;
}

export class LRUCache<K, V> {
  private capacity: number;
  private ttl: number;
  private cache: Map<K, CacheEntry<V>>;
  private hits: number;
  private misses: number;

  constructor(capacity: number, ttl?: number) {
    this.capacity = capacity;
    this.ttl = ttl ?? 5 * 60 * 1000;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    this.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.cache.delete(key);
      if (existing.timer) {
        global.clearTimeout(existing.timer);
      }
    }
    if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value as K;
      const firstEntry = this.cache.get(firstKey);
      if (firstEntry && firstEntry.timer) {
        global.clearTimeout(firstEntry.timer);
      }
      this.cache.delete(firstKey);
    }
    const timer = global.setTimeout(() => {
      this.cache.delete(key);
    }, this.ttl) as any;
    this.cache.set(key, { value, timer });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    if (entry.timer) {
      global.clearTimeout(entry.timer);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    for (const entry of this.cache.values()) {
      if (entry.timer) {
        global.clearTimeout(entry.timer);
      }
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) {
      return 0;
    }
    return this.hits / total;
  }

  get hitsCount(): number {
    return this.hits;
  }

  get missesCount(): number {
    return this.misses;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }
}
