package com.ordersystem.common.util;

import java.util.concurrent.atomic.AtomicLong;

public class SnowflakeIdGenerator {

    private static final AtomicLong SEQUENCE = new AtomicLong(0);
    private static final long TIMESTAMP_BITS = 41L;
    private static final long MAX_TIMESTAMP = ~(-1L << TIMESTAMP_BITS);
    private static final long EPOCH = 1704067200000L;

    private final long workerId;
    private long lastTimestamp = -1L;

    public SnowflakeIdGenerator(long workerId) {
        this.workerId = workerId;
    }

    public synchronized String nextId() {
        long timestamp = System.currentTimeMillis() - EPOCH;
        if (timestamp < 0) {
            throw new RuntimeException("Clock moved backwards");
        }
        if (timestamp == lastTimestamp) {
            long seq = SEQUENCE.incrementAndGet() & 0xFFF;
            if (seq == 0) {
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            SEQUENCE.set(0);
        }
        lastTimestamp = timestamp;
        long id = (timestamp << 22) | (workerId << 12) | (SEQUENCE.get() & 0xFFF);
        return String.valueOf(id);
    }

    private long tilNextMillis(long lastTimestamp) {
        long timestamp = System.currentTimeMillis() - EPOCH;
        while (timestamp <= lastTimestamp) {
            timestamp = System.currentTimeMillis() - EPOCH;
        }
        return timestamp;
    }
}
