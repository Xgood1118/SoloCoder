package com.audit.logger;

import com.audit.common.enums.LogLevel;
import com.audit.common.enums.LogType;
import com.audit.common.enums.OperationResult;
import com.audit.common.model.AuditLogEntry;
import com.audit.common.util.SequenceGenerator;
import com.audit.mask.MaskEngine;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLoggerService {

    private final MaskEngine maskEngine;
    private final SequenceGenerator sequenceGenerator;
    private final LogIntegrityChecker integrityChecker;
    private final AuditLogBuffer auditLogBuffer;
    private final AuditContext auditContext;
    private final ObjectMapper objectMapper;

    public void log(String operatorId, String operatorName, String operatorIp,
                    String action, String resourceType, String resourceId,
                    String description, String beforeData, String afterData,
                    LogLevel logLevel, LogType logType, OperationResult result,
                    String errorMessage, long durationMs, Map<String, String> tags,
                    Map<String, String> beforeDataMap, Map<String, String> afterDataMap) {

        AuditLogEntry entry = buildAuditLogEntry(
                operatorId, operatorName, operatorIp,
                action, resourceType, resourceId,
                description, beforeData, afterData,
                logLevel, logType, result,
                errorMessage, durationMs, tags,
                beforeDataMap, afterDataMap
        );

        auditLogBuffer.add(entry);
    }

    public AuditLogEntry log(AuditLogEntry entry) {
        AuditLogEntry maskedEntry = buildAuditLogEntry(
                entry.getOperatorId(),
                entry.getOperatorName(),
                entry.getOperatorIp(),
                entry.getAction(),
                entry.getResourceType(),
                entry.getResourceId(),
                entry.getDescription(),
                entry.getBeforeData(),
                entry.getAfterData(),
                entry.getLogLevel(),
                entry.getLogType(),
                entry.getResult(),
                entry.getErrorMessage(),
                entry.getDurationMs(),
                entry.getTags(),
                null,
                null
        );
        auditLogBuffer.add(maskedEntry);
        return maskedEntry;
    }

    public void log(Map<String, String> params) {
        String operatorId = params.get("operatorId");
        String operatorName = params.get("operatorName");
        String operatorIp = params.get("operatorIp");
        String action = params.get("action");
        String resourceType = params.get("resourceType");
        String resourceId = params.get("resourceId");
        String description = params.get("description");
        String beforeData = params.get("beforeData");
        String afterData = params.get("afterData");
        LogLevel logLevel = parseEnum(params.get("logLevel"), LogLevel.class, LogLevel.INFO);
        LogType logType = parseEnum(params.get("logType"), LogType.class, LogType.USER_OPERATION);
        OperationResult result = parseEnum(params.get("result"), OperationResult.class, OperationResult.SUCCESS);
        String errorMessage = params.get("errorMessage");
        long durationMs = parseLong(params.get("durationMs"), 0);

        log(operatorId, operatorName, operatorIp,
                action, resourceType, resourceId,
                description, beforeData, afterData,
                logLevel, logType, result,
                errorMessage, durationMs, null, null, null);
    }

    public AuditLogEntry buildAuditLogEntry(String operatorId, String operatorName, String operatorIp,
                                            String action, String resourceType, String resourceId,
                                            String description, String beforeData, String afterData,
                                            LogLevel logLevel, LogType logType, OperationResult result,
                                            String errorMessage, long durationMs, Map<String, String> tags,
                                            Map<String, String> beforeDataMap, Map<String, String> afterDataMap) {

        String maskedBeforeData = beforeData;
        String maskedAfterData = afterData;

        if (beforeDataMap != null && !beforeDataMap.isEmpty()) {
            Map<String, String> maskedBeforeMap = maskEngine.maskMap(beforeDataMap);
            try {
                maskedBeforeData = objectMapper.writeValueAsString(maskedBeforeMap);
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize beforeDataMap", e);
            }
        }

        if (afterDataMap != null && !afterDataMap.isEmpty()) {
            Map<String, String> maskedAfterMap = maskEngine.maskMap(afterDataMap);
            try {
                maskedAfterData = objectMapper.writeValueAsString(maskedAfterMap);
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize afterDataMap", e);
            }
        }

        String contextOperatorId = operatorId != null ? operatorId : auditContext.getOperatorId();
        String contextOperatorName = operatorName != null ? operatorName : auditContext.getOperatorName();
        String contextOperatorIp = operatorIp != null ? operatorIp : auditContext.getOperatorIp();

        AuditLogEntry entry = AuditLogEntry.builder()
                .id(UUID.randomUUID().toString())
                .sequenceNumber(sequenceGenerator.nextId())
                .traceId(auditContext.getTraceId())
                .timestamp(Instant.now())
                .operatorId(contextOperatorId)
                .operatorName(contextOperatorName)
                .operatorIp(contextOperatorIp)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .description(description)
                .beforeData(maskedBeforeData)
                .afterData(maskedAfterData)
                .logLevel(logLevel)
                .logType(logType)
                .result(result)
                .errorMessage(errorMessage)
                .durationMs(durationMs)
                .tags(tags)
                .build();

        String checksum = integrityChecker.computeChecksum(entry);
        entry.setChecksum(checksum);

        return entry;
    }

    private <T extends Enum<T>> T parseEnum(String value, Class<T> enumType, T defaultValue) {
        if (value == null || value.isEmpty()) {
            return defaultValue;
        }
        try {
            return Enum.valueOf(enumType, value.toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Invalid enum value for {}: {}", enumType.getSimpleName(), value);
            return defaultValue;
        }
    }

    private long parseLong(String value, long defaultValue) {
        if (value == null || value.isEmpty()) {
            return defaultValue;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            log.warn("Invalid long value: {}", value);
            return defaultValue;
        }
    }
}
