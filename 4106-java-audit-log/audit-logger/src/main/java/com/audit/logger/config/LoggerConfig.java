package com.audit.logger.config;

import com.audit.common.util.SequenceGenerator;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableScheduling
public class LoggerConfig {

    public static final String AUDIT_LOG_EXCHANGE = "audit.log.exchange";
    public static final String AUDIT_LOG_QUEUE = "audit.log.queue";
    public static final String AUDIT_LOG_DLQ = "audit.log.dlq";
    public static final String AUDIT_LOG_ROUTING_KEY = "audit.log.entry";
    public static final String AUDIT_LOG_DLQ_ROUTING_KEY = "audit.log.dlq";

    @Bean
    public TopicExchange auditLogExchange() {
        return new TopicExchange(AUDIT_LOG_EXCHANGE, true, false);
    }

    @Bean
    public Queue auditLogQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", AUDIT_LOG_EXCHANGE);
        args.put("x-dead-letter-routing-key", AUDIT_LOG_DLQ_ROUTING_KEY);
        return new Queue(AUDIT_LOG_QUEUE, true, false, false, args);
    }

    @Bean
    public Queue auditLogDlq() {
        return new Queue(AUDIT_LOG_DLQ, true, false, false);
    }

    @Bean
    public Binding auditLogBinding(TopicExchange auditLogExchange, Queue auditLogQueue) {
        return BindingBuilder.bind(auditLogQueue).to(auditLogExchange).with(AUDIT_LOG_ROUTING_KEY);
    }

    @Bean
    public Binding auditLogDlqBinding(TopicExchange auditLogExchange, Queue auditLogDlq) {
        return BindingBuilder.bind(auditLogDlq).to(auditLogExchange).with(AUDIT_LOG_DLQ_ROUTING_KEY);
    }

    @Bean
    public SequenceGenerator sequenceGenerator() {
        return new SequenceGenerator();
    }
}
