package com.mq.simulator.core;

import java.util.concurrent.TimeUnit;

public enum DelayLevel {
    LEVEL_1_SECOND(1, 1, TimeUnit.SECONDS),
    LEVEL_5_SECONDS(2, 5, TimeUnit.SECONDS),
    LEVEL_10_SECONDS(3, 10, TimeUnit.SECONDS),
    LEVEL_30_SECONDS(4, 30, TimeUnit.SECONDS),
    LEVEL_1_MINUTE(5, 1, TimeUnit.MINUTES),
    LEVEL_2_MINUTES(6, 2, TimeUnit.MINUTES),
    LEVEL_3_MINUTES(7, 3, TimeUnit.MINUTES),
    LEVEL_5_MINUTES(8, 5, TimeUnit.MINUTES),
    LEVEL_10_MINUTES(9, 10, TimeUnit.MINUTES),
    LEVEL_30_MINUTES(10, 30, TimeUnit.MINUTES),
    LEVEL_1_HOUR(11, 1, TimeUnit.HOURS),
    LEVEL_2_HOURS(12, 2, TimeUnit.HOURS);

    private final int level;
    private final long duration;
    private final TimeUnit unit;

    DelayLevel(int level, long duration, TimeUnit unit) {
        this.level = level;
        this.duration = duration;
        this.unit = unit;
    }

    public int getLevel() {
        return level;
    }

    public long getDuration() {
        return duration;
    }

    public TimeUnit getUnit() {
        return unit;
    }

    public long getDelayMillis() {
        return unit.toMillis(duration);
    }

    public static DelayLevel fromLevel(int level) {
        for (DelayLevel dl : values()) {
            if (dl.level == level) {
                return dl;
            }
        }
        throw new IllegalArgumentException("Unknown delay level: " + level);
    }

    public static DelayLevel fromMillis(long millis) {
        DelayLevel closest = LEVEL_1_SECOND;
        long minDiff = Math.abs(millis - closest.getDelayMillis());
        for (DelayLevel dl : values()) {
            long diff = Math.abs(millis - dl.getDelayMillis());
            if (diff < minDiff) {
                minDiff = diff;
                closest = dl;
            }
        }
        return closest;
    }
}
