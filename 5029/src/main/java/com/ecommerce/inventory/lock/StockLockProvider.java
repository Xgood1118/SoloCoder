package com.ecommerce.inventory.lock;

public interface StockLockProvider {

    boolean tryLock(String lockKey, long timeoutSeconds);

    void unlock(String lockKey);
}
