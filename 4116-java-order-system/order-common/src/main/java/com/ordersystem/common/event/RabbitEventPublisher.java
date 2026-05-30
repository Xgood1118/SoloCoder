package com.ordersystem.common.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.List;

@Slf4j
public class RabbitEventPublisher implements EventPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public RabbitEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    @Override
    public void publish(DomainEvent event) {
        try {
            String exchange = event.getEventType();
            String message = objectMapper.writeValueAsString(event);
            rabbitTemplate.convertAndSend(exchange, event.getEventId(), message);
        } catch (Exception e) {
            log.error("Failed to publish event: {}", event.getEventId(), e);
            throw new RuntimeException("Event publish failed", e);
        }
    }

    @Override
    public void publishBatch(List<DomainEvent> events) {
        events.forEach(this::publish);
    }
}
