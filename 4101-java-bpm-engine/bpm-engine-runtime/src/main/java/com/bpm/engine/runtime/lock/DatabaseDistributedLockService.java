package com.bpm.engine.runtime.lock;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "bpm.distributed.lock.type", havingValue = "database", matchIfMissing = true)
public class DatabaseDistributedLockService implements DistributedLockService {

    private final JdbcTemplate jdbcTemplate;

    private static final String TRY_LOCK_SQL =
            "INSERT INTO bpm_distributed_lock (lock_key, lock_owner, lock_time, expiry_time) " +
            "SELECT ?, ?, ?, ? WHERE NOT EXISTS (" +
            "  SELECT 1 FROM bpm_distributed_lock WHERE lock_key = ? AND expiry_time > ?" +
            ")";

    private static final String UNLOCK_SQL =
            "DELETE FROM bpm_distributed_lock WHERE lock_key = ? AND lock_owner = ?";

    private static final String IS_LOCKED_SQL =
            "SELECT COUNT(*) FROM bpm_distributed_lock WHERE lock_key = ? AND expiry_time > ?";

    @Override
    @Transactional
    public boolean tryLock(String lockKey, Duration timeout) {
        String owner = Thread.currentThread().getId() + ":" + ProcessHandle.current().pid();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiry = now.plus(timeout);
        int rows = jdbcTemplate.update(TRY_LOCK_SQL,
                lockKey, owner, now, expiry,
                lockKey, now);
        return rows > 0;
    }

    @Override
    @Transactional
    public void unlock(String lockKey) {
        String owner = Thread.currentThread().getId() + ":" + ProcessHandle.current().pid();
        jdbcTemplate.update(UNLOCK_SQL, lockKey, owner);
    }

    @Override
    public boolean isLocked(String lockKey) {
        LocalDateTime now = LocalDateTime.now();
        Integer count = jdbcTemplate.queryForObject(IS_LOCKED_SQL, Integer.class, lockKey, now);
        return count != null && count > 0;
    }
}
