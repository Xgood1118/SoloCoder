package com.cacheproxy.manager;

import com.cacheproxy.cache.Cache;
import com.cacheproxy.cache.CaffeineCache;
import com.cacheproxy.cache.RedisCache;
import com.cacheproxy.config.CacheProxyProperties;
import com.cacheproxy.core.CacheValueWrapper;
import com.cacheproxy.penetration.BloomFilterManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@RequiredArgsConstructor
public class TwoLevelCacheManager {

    private final CacheProxyProperties properties;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final BloomFilterManager bloomFilterManager;

    private final ConcurrentMap<String, CaffeineCache> l1Caches = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, RedisCache> l2Caches = new ConcurrentHashMap<>();

    public CaffeineCache getL1Cache(String name) {
        return l1Caches.computeIfAbsent(name, k -> new CaffeineCache(
                name,
                properties.getL1().getMaximumSize(),
                properties.getL1().getDefaultTtl(),
                properties.getL1().getTimeUnit()
        ));
    }

    public RedisCache getL2Cache(String name) {
        return l2Caches.computeIfAbsent(name, k -> new RedisCache(
                name,
                redisTemplate,
                objectMapper,
                properties
        ));
    }

    public CacheValueWrapper get(String cacheName, String key, boolean enablePenetrationProtect) {
        if (enablePenetrationProtect && !bloomFilterManager.mightContain(cacheName, key)) {
            log.debug("Bloom filter blocked key [{}] in cache [{}]", key, cacheName);
            return null;
        }

        Cache l1 = getL1Cache(cacheName);
        Object l1Value = l1.get(key);
        if (l1Value != null) {
            log.debug("L1 cache hit for key [{}] in cache [{}]", key, cacheName);
            bloomFilterManager.recordHit(cacheName, key);
            return (CacheValueWrapper) l1Value;
        }

        log.debug("L1 cache miss for key [{}] in cache [{}], checking L2", key, cacheName);

        Cache l2 = getL2Cache(cacheName);
        Object l2Value = l2.get(key);
        if (l2Value != null) {
            log.debug("L2 cache hit for key [{}] in cache [{}], backfilling L1", key, cacheName);
            CacheValueWrapper wrapper = (CacheValueWrapper) l2Value;
            l1.put(key, wrapper.getValue(), properties.getL1().getDefaultTtl(), properties.getL1().getTimeUnit());
            bloomFilterManager.recordHit(cacheName, key);
            return wrapper;
        }

        log.debug("L2 cache miss for key [{}] in cache [{}]", key, cacheName);
        bloomFilterManager.recordMiss(cacheName, key);
        return null;
    }

    public void put(String cacheName, String key, Object value, long l1Ttl, long l2Ttl, TimeUnit timeUnit) {
        Cache l1 = getL1Cache(cacheName);
        l1.put(key, value, l1Ttl, timeUnit);

        Cache l2 = getL2Cache(cacheName);
        l2.put(key, value, l2Ttl, timeUnit);

        bloomFilterManager.recordHit(cacheName, key);
        log.debug("Put key [{}] in both L1 and L2 caches [{}]", key, cacheName);
    }

    public void evict(String cacheName, String key) {
        Cache l1 = getL1Cache(cacheName);
        l1.evict(key);

        Cache l2 = getL2Cache(cacheName);
        l2.evict(key);

        log.debug("Evicted key [{}] from both L1 and L2 caches [{}]", key, cacheName);
    }

    public void evictAll(String cacheName) {
        CaffeineCache l1 = getL1Cache(cacheName);
        l1.evictAll();

        RedisCache l2 = getL2Cache(cacheName);
        l2.evictAll();

        bloomFilterManager.clear(cacheName);
        log.debug("Evicted all entries from both L1 and L2 caches [{}]", cacheName);
    }

    public void evictLocalOnly(String cacheName, String key) {
        Cache l1 = getL1Cache(cacheName);
        l1.evict(key);
        log.debug("Evicted key [{}] from L1 cache only [{}]", key, cacheName);
    }

    public void evictAllLocalOnly(String cacheName) {
        Cache l1 = getL1Cache(cacheName);
        l1.evictAll();
        log.debug("Evicted all entries from L1 cache only [{}]", cacheName);
    }
}
