package com.audit.common.model;

import com.audit.common.enums.LogLevel;
import com.audit.common.enums.LogType;
import com.audit.common.enums.OperationResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogEntry {

    private String id;
    private long sequenceNumber;
    private String traceId;
    private Instant timestamp;

    private String operatorId;
    private String operatorName;
    private String operatorIp;
    private String operatorTerminal;

    private String action;
    private String resourceType;
    private String resourceId;
    private String description;

    private String beforeData;
    private String afterData;

    private LogLevel logLevel;
    private LogType logType;
    private OperationResult result;

    private String errorMessage;
    private long durationMs;

    private Map<String, String> tags;
    private String checksum;
}
