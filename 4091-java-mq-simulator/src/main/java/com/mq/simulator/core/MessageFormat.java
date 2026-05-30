package com.mq.simulator.core;

public enum MessageFormat {
    JSON("JSON"),
    XML("XML"),
    PLAINTEXT("PlainText"),
    AVRO("Avro"),
    PROTOBUF("Protobuf");

    private final String displayName;

    MessageFormat(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static MessageFormat fromString(String value) {
        for (MessageFormat format : values()) {
            if (format.name().equalsIgnoreCase(value) || format.displayName.equalsIgnoreCase(value)) {
                return format;
            }
        }
        throw new IllegalArgumentException("Unknown message format: " + value);
    }
}
