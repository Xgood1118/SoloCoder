package com.ordersystem.common.config;

import com.ordersystem.common.event.EventPublisher;
import com.ordersystem.common.event.RabbitEventPublisher;
import com.ordersystem.common.id.IdGenerator;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CommonConfig {

    @Value("${id-generator.worker-id:1}")
    private long workerId;

    @Value("${id-generator.datacenter-id:1}")
    private long datacenterId;

    @Bean
    public IdGenerator idGenerator() {
        return new IdGenerator(workerId, datacenterId);
    }

    @Bean
    public EventPublisher eventPublisher(RabbitTemplate rabbitTemplate) {
        return new RabbitEventPublisher(rabbitTemplate);
    }
}
