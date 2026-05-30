package com.ordersystem.common.event;

import java.util.List;

public interface EventPublisher {

    void publish(DomainEvent event);

    void publishBatch(List<DomainEvent> events);
}
