package com.audit.logger;

import com.audit.common.enums.AlarmLevel;
import com.audit.common.model.AlarmEvent;
import com.audit.common.model.AuditLogEntry;
import com.audit.logger.config.LoggerConfig;
import com.audit.alarm.AlarmNotifier;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogBuffer {

    private final LinkedBlockingQueue<AuditLogEntry> queue = new LinkedBlockingQueue<>();
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final AlarmNotifier alarmNotifier;
    private final AtomicReference<Consumer<AuditLogEntry>> consumerRef = new AtomicReference<>();

    private static final int MAX_RETRIES = 3;
    private static final int BATCH_SIZE = 100;

    public void add(AuditLogEntry entry) {
        queue.offer(entry);
    }

    public List<AuditLogEntry> drainTo(int max) {
        List<AuditLogEntry> entries = new ArrayList<>();
        queue.drainTo(entries, max);
        return entries;
    }

    public int size() {
        return queue.size();
    }

    public void setConsumer(Consumer<AuditLogEntry> consumer) {
        this.consumerRef.set(consumer);
    }

    @Scheduled(fixedDelay = 500)
    public void flush() {
        List<AuditLogEntry> entries = drainTo(BATCH_SIZE);
        if (entries.isEmpty()) {
            return;
        }
        for (AuditLogEntry entry : entries) {
            publishWithRetry(entry);
        }
    }

    private void publishWithRetry(AuditLogEntry entry) {
        int attempt = 0;
        boolean success = false;
        while (attempt < MAX_RETRIES && !success) {
            try {
                publish(entry);
                success = true;
            } catch (Exception e) {
                attempt++;
                log.warn("Failed to publish audit log entry, attempt {}/{}: {}", attempt, MAX_RETRIES, e.getMessage());
                if (attempt >= MAX_RETRIES) {
                    handlePermanentFailure(entry, e);
                } else {
                    try {
                        Thread.sleep(100L * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
    }

    private void publish(AuditLogEntry entry) throws JsonProcessingException {
        Consumer<AuditLogEntry> consumer = consumerRef.get();
        if (consumer != null) {
            consumer.accept(entry);
        }
        String json = objectMapper.writeValueAsString(entry);
        Message message = MessageBuilder
                .withBody(json.getBytes())
                .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                .build();
        rabbitTemplate.send(LoggerConfig.AUDIT_LOG_EXCHANGE, LoggerConfig.AUDIT_LOG_ROUTING_KEY, message);
    }

    private void handlePermanentFailure(AuditLogEntry entry, Exception e) {
        log.error("Permanent failure publishing audit log entry {} after {} attempts: {}",
                entry.getId(), MAX_RETRIES, e.getMessage());
        try {
            sendToDlq(entry);
        } catch (Exception dlqEx) {
            log.error("Failed to send to DLQ: {}", dlqEx.getMessage());
        }
        triggerAlarm(entry, e);
    }

    private void sendToDlq(AuditLogEntry entry) throws JsonProcessingException {
        String json = objectMapper.writeValueAsString(entry);
        Message message = MessageBuilder
                .withBody(json.getBytes())
                .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                .build();
        rabbitTemplate.send(LoggerConfig.AUDIT_LOG_EXCHANGE, LoggerConfig.AUDIT_LOG_DLQ_ROUTING_KEY, message);
    }

    private void triggerAlarm(AuditLogEntry entry, Exception e) {
        AlarmEvent event = AlarmEvent.builder()
                .id(UUID.randomUUID().toString())
                .ruleId("AUDIT_LOG_PUBLISH_FAILURE")
                .ruleName("Audit Log Publish Failure")
                .alarmLevel(AlarmLevel.CRITICAL)
                .description("Failed to publish audit log entry after " + MAX_RETRIES + " attempts: " + e.getMessage())
                .sourceLogId(entry.getId())
                .operatorId(entry.getOperatorId())
                .operatorIp(entry.getOperatorIp())
                .triggeredAt(Instant.now())
                .build();
        alarmNotifier.notify(event);
    }
}
