package com.ordersystem.common.event;

import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public abstract class DomainEvent {

    private final String eventId;
    private final String eventType;
    private final LocalDateTime occurredAt;

    protected DomainEvent(String eventId, String eventType) {
        this.eventId = eventId;
        this.eventType = eventType;
        this.occurredAt = LocalDateTime.now();
    }
}
