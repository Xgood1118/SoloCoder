package com.cacheproxy.cache;

import com.cacheproxy.core.CacheValueWrapper;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

public class CaffeineCache implements Cache {

    private final String name;
    private final com.github.benmanes.caffeine.cache.Cache<String, CacheValueWrapper> cache;

    public CaffeineCache(String name, long maximumSize, long defaultTtl, TimeUnit timeUnit) {
        this.name = name;
        this.cache = Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .expireAfterWrite(defaultTtl, timeUnit)
                .build();
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public Object get(String key) {
        CacheValueWrapper wrapper = cache.getIfPresent(key);
        if (wrapper == null) {
            return null;
        }
        if (wrapper.isExpired()) {
            cache.invalidate(key);
            return null;
        }
        return wrapper;
    }

    @Override
    public void put(String key, Object value, long ttl, TimeUnit timeUnit) {
        CacheValueWrapper wrapper = CacheValueWrapper.of(value, timeUnit.toMillis(ttl));
        cache.put(key, wrapper);
    }

    @Override
    public void evict(String key) {
        cache.invalidate(key);
    }

    @Override
    public void evictAll() {
        cache.invalidateAll();
    }

    @Override
    public boolean containsKey(String key) {
        return cache.getIfPresent(key) != null;
    }

    public ConcurrentMap<String, CacheValueWrapper> asMap() {
        return cache.asMap();
    }
}
