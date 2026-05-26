package com.cacheproxy.penetration;

import com.cacheproxy.config.CacheProxyProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@RequiredArgsConstructor
public class BloomFilterManager {

    private final CacheProxyProperties properties;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private final ConcurrentMap<String, AtomicInteger> missCounter = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, com.github.benmanes.caffeine.cache.Cache<String, BloomFilter>> localBloomFilters = new ConcurrentHashMap<>();

    private static final String BLOOM_KEY_PREFIX = "cache:proxy:bloom:";

    public boolean mightContain(String cacheName, String key) {
        if (!properties.getPenetration().isEnabled()) {
            return true;
        }
        BloomFilter filter = getOrCreateBloomFilter(cacheName);
        return filter.mightContain(key);
    }

    public void recordMiss(String cacheName, String key) {
        if (!properties.getPenetration().isEnabled()) {
            return;
        }

        String counterKey = cacheName + ":" + key;
        AtomicInteger count = missCounter.computeIfAbsent(counterKey, k -> new AtomicInteger(0));
        int current = count.incrementAndGet();

        int threshold = properties.getPenetration().getMissThreshold();
        if (current >= threshold) {
            BloomFilter filter = getOrCreateBloomFilter(cacheName);
            if (!filter.mightContain(key)) {
                filter.put(key);
                persistBloomFilter(cacheName, filter);
                log.debug("Added key [{}] to bloom filter for cache [{}] after {} misses", key, cacheName, current);
            }
            missCounter.remove(counterKey);
        }
    }

    public void recordHit(String cacheName, String key) {
        String counterKey = cacheName + ":" + key;
        missCounter.remove(counterKey);
    }

    public void clear(String cacheName) {
        localBloomFilters.remove(cacheName);
        String bloomKey = BLOOM_KEY_PREFIX + cacheName;
        redisTemplate.delete(bloomKey);
        missCounter.keySet().removeIf(k -> k.startsWith(cacheName + ":"));
    }

    @SuppressWarnings("unchecked")
    private BloomFilter getOrCreateBloomFilter(String cacheName) {
        com.github.benmanes.caffeine.cache.Cache<String, BloomFilter> cache = localBloomFilters.computeIfAbsent(cacheName, k -> Caffeine.newBuilder()
                .expireAfterWrite(properties.getPenetration().getBloomTtl(), properties.getPenetration().getTimeUnit())
                .build());

        BloomFilter filter = cache.getIfPresent(cacheName);
        if (filter == null) {
            filter = loadBloomFilter(cacheName);
            if (filter == null) {
                filter = BloomFilter.create(
                        Funnels.stringFunnel(StandardCharsets.UTF_8),
                        properties.getPenetration().getBloomExpectedInsertions(),
                        properties.getPenetration().getBloomFpp()
                );
            }
            cache.put(cacheName, filter);
        }
        return filter;
    }

    @SneakyThrows
    private void persistBloomFilter(String cacheName, BloomFilter filter) {
        String bloomKey = BLOOM_KEY_PREFIX + cacheName;
        byte[] bytes = objectMapper.writeValueAsBytes(filter);
        redisTemplate.opsForValue().set(bloomKey, new String(bytes, StandardCharsets.ISO_8859_1),
                properties.getPenetration().getBloomTtl(), properties.getPenetration().getTimeUnit());
    }

    @SneakyThrows
    private BloomFilter loadBloomFilter(String cacheName) {
        String bloomKey = BLOOM_KEY_PREFIX + cacheName;
        String value = redisTemplate.opsForValue().get(bloomKey);
        if (value == null) {
            return null;
        }
        try {
            byte[] bytes = value.getBytes(StandardCharsets.ISO_8859_1);
            return objectMapper.readValue(bytes, BloomFilter.class);
        } catch (Exception e) {
            log.warn("Failed to load bloom filter for cache [{}]: {}", cacheName, e.getMessage());
            return null;
        }
    }
}
