package cache

import (
	"sync"
	"time"
)

type MemoryCache struct {
	data map[string]*cacheItem
	mu   sync.RWMutex
}

type cacheItem struct {
	value      interface{}
	expireAt   time.Time
	expiration time.Duration
}

var (
	memoryCache *MemoryCache
	once        sync.Once
)

func GetMemoryCache() *MemoryCache {
	once.Do(func() {
		memoryCache = &MemoryCache{
			data: make(map[string]*cacheItem),
		}
		go memoryCache.cleanupLoop()
	})
	return memoryCache
}

func (c *MemoryCache) Set(key string, value interface{}, expiration time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[key] = &cacheItem{
		value:      value,
		expireAt:   time.Now().Add(expiration),
		expiration: expiration,
	}
}

func (c *MemoryCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	item, exists := c.data[key]
	if !exists {
		return nil, false
	}
	if time.Now().After(item.expireAt) {
		delete(c.data, key)
		return nil, false
	}
	return item.value, true
}

func (c *MemoryCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.data, key)
}

func (c *MemoryCache) DeleteByPattern(pattern string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key := range c.data {
		if matchPattern(pattern, key) {
			delete(c.data, key)
		}
	}
}

func (c *MemoryCache) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		c.cleanup()
	}
}

func (c *MemoryCache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for key, item := range c.data {
		if now.After(item.expireAt) {
			delete(c.data, key)
		}
	}
}

func matchPattern(pattern, key string) bool {
	if len(pattern) == 0 {
		return true
	}
	if len(key) == 0 {
		return false
	}
	return len(key) >= len(pattern) && key[:len(pattern)] == pattern[:len(pattern)]
}
