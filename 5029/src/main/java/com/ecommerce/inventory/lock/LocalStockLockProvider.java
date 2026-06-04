package com.ecommerce.inventory.lock;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Component
@ConditionalOnProperty(name = "stock.lock.provider", havingValue = "local", matchIfMissing = true)
@Slf4j
public class LocalStockLockProvider implements StockLockProvider {

    private final ConcurrentHashMap<String, ReentrantLock> lockRegistry = new ConcurrentHashMap<>();

    @Override
    public boolean tryLock(String lockKey, long timeoutSeconds) {
        ReentrantLock lock = lockRegistry.computeIfAbsent(lockKey, k -> new ReentrantLock());
        try {
            return lock.tryLock(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    @Override
    public void unlock(String lockKey) {
        ReentrantLock lock = lockRegistry.get(lockKey);
        if (lock != null && lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
}
