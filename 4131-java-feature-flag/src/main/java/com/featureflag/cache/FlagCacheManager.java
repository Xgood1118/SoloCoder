package com.featureflag.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class FlagCacheManager {

    private final ConcurrentHashMap<String, Cache<String, Object>> flagCaches = new ConcurrentHashMap<>();

    public Cache<String, Object> getOrCreateCache(String flagKey, int expireSeconds, int maxSize) {
        return flagCaches.computeIfAbsent(flagKey, k ->
                Caffeine.newBuilder()
                        .expireAfterWrite(expireSeconds, TimeUnit.SECONDS)
                        .maximumSize(maxSize)
                        .recordStats()
                        .build()
        );
    }

    public void invalidateFlagCache(String flagKey) {
        Cache<String, Object> cache = flagCaches.remove(flagKey);
        if (cache != null) {
            cache.invalidateAll();
            log.info("Cache invalidated for flag: {}", flagKey);
        }
    }

    public void invalidateAll() {
        flagCaches.forEach((k, v) -> v.invalidateAll());
        flagCaches.clear();
        log.info("All caches invalidated");
    }

    public void invalidateCacheEntry(String flagKey, String cacheKey) {
        Cache<String, Object> cache = flagCaches.get(flagKey);
        if (cache != null) {
            cache.invalidate(cacheKey);
            log.debug("Cache entry invalidated: {} - {}", flagKey, cacheKey);
        }
    }

    public Object getFromCache(String flagKey, String cacheKey) {
        Cache<String, Object> cache = flagCaches.get(flagKey);
        if (cache != null) {
            return cache.getIfPresent(cacheKey);
        }
        return null;
    }

    public void putInCache(String flagKey, String cacheKey, Object value, int expireSeconds) {
        Cache<String, Object> cache = getOrCreateCache(flagKey, expireSeconds, 1000);
        cache.put(cacheKey, value);
    }
}
