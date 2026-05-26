package com.cacheproxy.cache;

import com.cacheproxy.config.CacheProxyProperties;
import com.cacheproxy.core.CacheValueWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.concurrent.TimeUnit;

@RequiredArgsConstructor
public class RedisCache implements Cache {

    private final String name;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final CacheProxyProperties properties;

    @Override
    public String getName() {
        return name;
    }

    private String buildKey(String key) {
        return properties.getL2().getKeyPrefix() + name + ":" + key;
    }

    @SneakyThrows
    @Override
    public Object get(String key) {
        String redisKey = buildKey(key);
        String valueStr = redisTemplate.opsForValue().get(redisKey);
        if (valueStr == null) {
            return null;
        }
        CacheValueWrapper wrapper = objectMapper.readValue(valueStr, CacheValueWrapper.class);
        if (wrapper.isExpired()) {
            redisTemplate.delete(redisKey);
            return null;
        }
        return wrapper;
    }

    @SneakyThrows
    @Override
    public void put(String key, Object value, long ttl, TimeUnit timeUnit) {
        String redisKey = buildKey(key);
        CacheValueWrapper wrapper = CacheValueWrapper.of(value, timeUnit.toMillis(ttl));
        String valueStr = objectMapper.writeValueAsString(wrapper);
        redisTemplate.opsForValue().set(redisKey, valueStr, ttl, timeUnit);
    }

    @Override
    public void evict(String key) {
        String redisKey = buildKey(key);
        redisTemplate.delete(redisKey);
    }

    @Override
    public void evictAll() {
        String pattern = properties.getL2().getKeyPrefix() + name + ":*";
        var keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    @Override
    public boolean containsKey(String key) {
        String redisKey = buildKey(key);
        return Boolean.TRUE.equals(redisTemplate.hasKey(redisKey));
    }
}
