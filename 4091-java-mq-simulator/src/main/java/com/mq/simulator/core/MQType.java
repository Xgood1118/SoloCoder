package com.mq.simulator.core;

public enum MQType {
    RABBITMQ("RabbitMQ"),
    KAFKA("Kafka"),
    ROCKETMQ("RocketMQ");

    private final String displayName;

    MQType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static MQType fromString(String value) {
        for (MQType type : values()) {
            if (type.name().equalsIgnoreCase(value) || type.displayName.equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown MQ type: " + value);
    }
}
