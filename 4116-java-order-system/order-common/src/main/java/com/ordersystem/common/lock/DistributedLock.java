package com.ordersystem.common.lock;

import java.util.concurrent.TimeUnit;

public interface DistributedLock {

    boolean tryLock(String key, long waitTime, long leaseTime, TimeUnit unit);

    void unlock(String key);
}
