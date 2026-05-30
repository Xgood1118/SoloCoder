package com.audit.common.model;

import com.audit.common.enums.AlarmLevel;
import com.audit.common.enums.AlarmStatus;
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
public class AlarmEvent {

    private String id;
    private String ruleId;
    private String ruleName;
    private AlarmLevel alarmLevel;
    private AlarmStatus status;

    private String description;
    private String sourceLogId;
    private String operatorId;
    private String operatorIp;

    private Instant triggeredAt;
    private Instant resolvedAt;
    private String resolvedBy;

    private int suppressCount;
    private Instant lastSuppressedAt;

    private Map<String, String> context;
}
