package com.bpm.engine.runtime.lock;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Collections;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "bpm.distributed.lock.type", havingValue = "redis")
public class RedisDistributedLockService implements DistributedLockService {

    private final RedisTemplate<String, String> redisTemplate;

    private static final String UNLOCK_SCRIPT =
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
            "  return redis.call('del', KEYS[1]) " +
            "else " +
            "  return 0 " +
            "end";

    private static final String LOCK_PREFIX = "bpm:lock:";

    @Override
    public boolean tryLock(String lockKey, Duration timeout) {
        String key = LOCK_PREFIX + lockKey;
        String value = Thread.currentThread().getId() + ":" + System.currentTimeMillis();
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(key, value, timeout);
        return Boolean.TRUE.equals(acquired);
    }

    @Override
    public void unlock(String lockKey) {
        String key = LOCK_PREFIX + lockKey;
        String value = redisTemplate.opsForValue().get(key);
        if (value != null) {
            DefaultRedisScript<Long> script = new DefaultRedisScript<>(UNLOCK_SCRIPT, Long.class);
            redisTemplate.execute(script, Collections.singletonList(key), value);
        }
    }

    @Override
    public boolean isLocked(String lockKey) {
        String key = LOCK_PREFIX + lockKey;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }
}
