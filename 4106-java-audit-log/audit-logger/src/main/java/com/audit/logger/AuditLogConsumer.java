package com.audit.logger;

import com.audit.common.enums.AlarmLevel;
import com.audit.common.enums.StorageType;
import com.audit.common.model.AlarmEvent;
import com.audit.common.model.AuditLogEntry;
import com.audit.logger.config.LoggerConfig;
import com.audit.storage.StorageRouter;
import com.audit.alarm.AlarmNotifier;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogConsumer {

    private final StorageRouter storageRouter;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate stringRedisTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final AlarmNotifier alarmNotifier;

    private static final int MAX_RETRIES = 5;
    private static final String FAILURE_COUNT_PREFIX = "audit:log:failure:";
    private static final long RETRY_BASE_DELAY_MS = 1000;

    @RabbitListener(queues = LoggerConfig.AUDIT_LOG_QUEUE)
    public void consume(Message message) {
        String messageId = message.getMessageProperties().getMessageId();
        if (messageId == null) {
            messageId = UUID.randomUUID().toString();
        }

        AuditLogEntry entry;
        try {
            entry = objectMapper.readValue(message.getBody(), AuditLogEntry.class);
        } catch (Exception e) {
            log.error("Failed to deserialize audit log message: {}", e.getMessage());
            handleDeserializationFailure(message, e);
            return;
        }

        int failureCount = getFailureCount(entry.getId());
        if (failureCount >= MAX_RETRIES) {
            log.warn("Max retries exceeded for entry {}, moving to DLQ", entry.getId());
            moveToDlq(entry);
            clearFailureCount(entry.getId());
            return;
        }

        try {
            storageRouter.saveToAll(entry);
            clearFailureCount(entry.getId());
            log.debug("Successfully processed audit log entry: {}", entry.getId());
        } catch (Exception e) {
            int newFailureCount = failureCount + 1;
            log.warn("Failed to process audit log entry {}, attempt {}/{}: {}",
                    entry.getId(), newFailureCount, MAX_RETRIES, e.getMessage());
            incrementFailureCount(entry.getId());

            if (newFailureCount >= MAX_RETRIES) {
                log.warn("Max retries reached for entry {}, moving to DLQ", entry.getId());
                moveToDlq(entry);
                clearFailureCount(entry.getId());
            } else {
                scheduleRetry(entry, newFailureCount);
            }
        }
    }

    private void scheduleRetry(AuditLogEntry entry, int failureCount) {
        try {
            String json = objectMapper.writeValueAsString(entry);
            Message retryMessage = MessageBuilder
                    .withBody(json.getBytes())
                    .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                    .setMessageId(UUID.randomUUID().toString())
                    .setHeader("retry-count", failureCount)
                    .build();

            rabbitTemplate.send(LoggerConfig.AUDIT_LOG_EXCHANGE, LoggerConfig.AUDIT_LOG_ROUTING_KEY, retryMessage);
            log.debug("Scheduled retry for entry {}, attempt {}", entry.getId(), failureCount);
        } catch (Exception e) {
            log.error("Failed to schedule retry for entry {}: {}", entry.getId(), e.getMessage());
            moveToDlq(entry);
            clearFailureCount(entry.getId());
        }
    }

    private int getFailureCount(String entryId) {
        String key = FAILURE_COUNT_PREFIX + entryId;
        String value = stringRedisTemplate.opsForValue().get(key);
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private void incrementFailureCount(String entryId) {
        String key = FAILURE_COUNT_PREFIX + entryId;
        stringRedisTemplate.opsForValue().increment(key);
        stringRedisTemplate.expire(key, 24, TimeUnit.HOURS);
    }

    private void clearFailureCount(String entryId) {
        String key = FAILURE_COUNT_PREFIX + entryId;
        stringRedisTemplate.delete(key);
    }

    private void moveToDlq(AuditLogEntry entry) {
        try {
            String json = objectMapper.writeValueAsString(entry);
            Message message = MessageBuilder
                    .withBody(json.getBytes())
                    .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                    .build();
            rabbitTemplate.send(LoggerConfig.AUDIT_LOG_EXCHANGE, LoggerConfig.AUDIT_LOG_DLQ_ROUTING_KEY, message);
            notifyDlq(entry);
        } catch (Exception e) {
            log.error("Failed to move entry {} to DLQ: {}", entry.getId(), e.getMessage());
        }
    }

    private void handleDeserializationFailure(Message message, Exception e) {
        try {
            rabbitTemplate.send(LoggerConfig.AUDIT_LOG_EXCHANGE, LoggerConfig.AUDIT_LOG_DLQ_ROUTING_KEY, message);
        } catch (Exception ex) {
            log.error("Failed to send malformed message to DLQ: {}", ex.getMessage());
        }
    }

    private void notifyDlq(AuditLogEntry entry) {
        AlarmEvent event = AlarmEvent.builder()
                .id(UUID.randomUUID().toString())
                .ruleId("AUDIT_LOG_CONSUME_FAILURE")
                .ruleName("Audit Log Consume Failure")
                .alarmLevel(AlarmLevel.CRITICAL)
                .description("Audit log entry moved to DLQ after " + MAX_RETRIES + " retries")
                .sourceLogId(entry.getId())
                .operatorId(entry.getOperatorId())
                .operatorIp(entry.getOperatorIp())
                .triggeredAt(Instant.now())
                .build();
        alarmNotifier.notify(event);
    }
}
