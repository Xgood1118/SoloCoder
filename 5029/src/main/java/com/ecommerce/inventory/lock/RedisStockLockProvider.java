package com.ecommerce.inventory.lock;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
@ConditionalOnProperty(name = "stock.lock.provider", havingValue = "redis")
@Slf4j
public class RedisStockLockProvider implements StockLockProvider {

    private final StringRedisTemplate redisTemplate;
    private static final String LOCK_VALUE_PREFIX = "inventory-lock:";

    public RedisStockLockProvider(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean tryLock(String lockKey, long timeoutSeconds) {
        String lockValue = LOCK_VALUE_PREFIX + Thread.currentThread().getId() + ":" + System.currentTimeMillis();
        Boolean result = redisTemplate.opsForValue()
                .setIfAbsent(lockKey, lockValue, timeoutSeconds, TimeUnit.SECONDS);
        boolean locked = Boolean.TRUE.equals(result);
        if (locked) {
            log.debug("Redis lock acquired: key={}", lockKey);
        }
        return locked;
    }

    @Override
    public void unlock(String lockKey) {
        redisTemplate.delete(lockKey);
        log.debug("Redis lock released: key={}", lockKey);
    }
}
