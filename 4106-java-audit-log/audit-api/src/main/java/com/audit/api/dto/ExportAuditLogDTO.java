package com.audit.api.dto;

import com.alibaba.excel.annotation.ExcelProperty;
import com.audit.common.model.AuditLogEntry;
import lombok.Data;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Data
public class ExportAuditLogDTO {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @ExcelProperty(index = 0, value = "ID")
    private String id;

    @ExcelProperty(index = 1, value = "Sequence Number")
    private long sequenceNumber;

    @ExcelProperty(index = 2, value = "Trace ID")
    private String traceId;

    @ExcelProperty(index = 3, value = "Timestamp")
    private String timestamp;

    @ExcelProperty(index = 4, value = "Operator ID")
    private String operatorId;

    @ExcelProperty(index = 5, value = "Operator Name")
    private String operatorName;

    @ExcelProperty(index = 6, value = "Operator IP")
    private String operatorIp;

    @ExcelProperty(index = 7, value = "Operator Terminal")
    private String operatorTerminal;

    @ExcelProperty(index = 8, value = "Action")
    private String action;

    @ExcelProperty(index = 9, value = "Resource Type")
    private String resourceType;

    @ExcelProperty(index = 10, value = "Resource ID")
    private String resourceId;

    @ExcelProperty(index = 11, value = "Description")
    private String description;

    @ExcelProperty(index = 12, value = "Before Data")
    private String beforeData;

    @ExcelProperty(index = 13, value = "After Data")
    private String afterData;

    @ExcelProperty(index = 14, value = "Log Level")
    private String logLevel;

    @ExcelProperty(index = 15, value = "Log Type")
    private String logType;

    @ExcelProperty(index = 16, value = "Result")
    private String result;

    @ExcelProperty(index = 17, value = "Error Message")
    private String errorMessage;

    @ExcelProperty(index = 18, value = "Duration (ms)")
    private long durationMs;

    @ExcelProperty(index = 19, value = "Tags")
    private String tags;

    @ExcelProperty(index = 20, value = "Checksum")
    private String checksum;

    public static ExportAuditLogDTO from(AuditLogEntry entry, ZoneId zoneId) {
        ExportAuditLogDTO dto = new ExportAuditLogDTO();
        dto.setId(entry.getId());
        dto.setSequenceNumber(entry.getSequenceNumber());
        dto.setTraceId(entry.getTraceId());
        if (entry.getTimestamp() != null) {
            ZonedDateTime zonedDateTime = entry.getTimestamp().atZone(zoneId);
            dto.setTimestamp(zonedDateTime.format(FORMATTER));
        }
        dto.setOperatorId(entry.getOperatorId());
        dto.setOperatorName(entry.getOperatorName());
        dto.setOperatorIp(entry.getOperatorIp());
        dto.setOperatorTerminal(entry.getOperatorTerminal());
        dto.setAction(entry.getAction());
        dto.setResourceType(entry.getResourceType());
        dto.setResourceId(entry.getResourceId());
        dto.setDescription(entry.getDescription());
        dto.setBeforeData(entry.getBeforeData());
        dto.setAfterData(entry.getAfterData());
        dto.setLogLevel(entry.getLogLevel() != null ? entry.getLogLevel().name() : null);
        dto.setLogType(entry.getLogType() != null ? entry.getLogType().name() : null);
        dto.setResult(entry.getResult() != null ? entry.getResult().name() : null);
        dto.setErrorMessage(entry.getErrorMessage());
        dto.setDurationMs(entry.getDurationMs());
        dto.setTags(entry.getTags() != null ? entry.getTags().toString() : null);
        dto.setChecksum(entry.getChecksum());
        return dto;
    }
}
