package com.mq.simulator.core;

public enum SendStrategy {
    IMMEDIATE("立即发送"),
    SCHEDULED("指定时间发送"),
    INTERVAL("间隔发送"),
    BURST("突发发送"),
    WARMUP("预热发送");

    private final String displayName;

    SendStrategy(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
