package com.ordersystem.common.idempotent;

public class IdempotentKey {

    private static final String SEPARATOR = ":";

    public static String build(Long userId, String bizType, long timestamp) {
        return userId + SEPARATOR + bizType + SEPARATOR + timestamp;
    }

    public static String build(String userId, String bizType, long timestamp) {
        return userId + SEPARATOR + bizType + SEPARATOR + timestamp;
    }
}
