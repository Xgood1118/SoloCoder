package com.audit.common.util;

import java.util.concurrent.atomic.AtomicLong;

public class SequenceGenerator {

    private final AtomicLong sequence;
    private final long epochMillis;

    public SequenceGenerator() {
        this.epochMillis = System.currentTimeMillis();
        this.sequence = new AtomicLong(0);
    }

    public SequenceGenerator(long startValue) {
        this.epochMillis = System.currentTimeMillis();
        this.sequence = new AtomicLong(startValue);
    }

    public long nextId() {
        return sequence.incrementAndGet();
    }

    public long current() {
        return sequence.get();
    }

    public long getEpochMillis() {
        return epochMillis;
    }
}
