import { LRUCache } from '../cache/lru-cache';
import { SearchCache } from '../cache/search-cache';

describe('Cache Tests', () => {
  describe('LRUCache', () => {
    it('should create cache with given capacity', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.size).toBe(0);
    });

    it('should set and get values', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
    });

    it('should return null for non-existent keys', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should evict least recently used when capacity exceeded', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);

      expect(cache.size).toBe(3);
      expect(cache.get('a')).toBeNull();
      expect(cache.get('d')).toBe(4);
    });

    it('should update access order on get', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.get('a');
      cache.set('d', 4);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeNull();
    });

    it('should delete entries', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeNull();
    });

    it('should return false when deleting non-existent key', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('should check if key exists', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });

    it('should track hit rate', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.get('a');
      cache.get('b');

      expect(cache.hitRate).toBe(0.5);
      expect(cache.hitsCount).toBe(1);
      expect(cache.missesCount).toBe(1);
    });
  });

  describe('SearchCache', () => {
    it('should create search cache', () => {
      const cache = new SearchCache(100, 60000);
      expect(cache).toBeDefined();
    });

    it('should build cache keys from query and options', () => {
      const cache = new SearchCache(100, 60000);
      const key1 = cache.buildKey('query1', { from: 0, size: 10 });
      const key2 = cache.buildKey('query1', { from: 0, size: 10 });
      const key3 = cache.buildKey('query2', { from: 0, size: 10 });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should set and get cached search results', () => {
      const cache = new SearchCache(100, 60000);
      const result = { results: [{ id: '1', score: 1.0 }], total: 1 };

      cache.set('test query', result, {});
      const cached = cache.get('test query', {});

      expect(cached).toEqual(result);
    });

    it('should invalidate cache entries', () => {
      const cache = new SearchCache(100, 60000);
      cache.set('query1', { results: [], total: 0 }, {});
      cache.set('query2', { results: [], total: 0 }, {});

      cache.invalidate();

      expect(cache.get('query1', {})).toBeNull();
    });

    it('should return cache stats', () => {
      const cache = new SearchCache(100, 60000);
      cache.set('query1', { results: [], total: 0 }, {});
      cache.get('query1', {});
      cache.get('query2', {});

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.capacity).toBe(100);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });
});
