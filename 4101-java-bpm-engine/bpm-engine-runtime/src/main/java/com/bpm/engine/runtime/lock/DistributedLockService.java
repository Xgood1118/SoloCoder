package com.bpm.engine.runtime.lock;

import java.time.Duration;

public interface DistributedLockService {

    boolean tryLock(String lockKey, Duration timeout);

    void unlock(String lockKey);

    boolean isLocked(String lockKey);
}
