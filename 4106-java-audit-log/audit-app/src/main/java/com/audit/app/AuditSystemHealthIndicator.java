package com.audit.app;

import com.audit.logger.LogIntegrityChecker;
import com.audit.logger.AuditLogBuffer;
import com.audit.alarm.AlarmService;
import com.audit.common.enums.AlarmLevel;
import com.audit.common.enums.AlarmStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("audit")
@RequiredArgsConstructor
public class AuditSystemHealthIndicator implements HealthIndicator {

    private final LogIntegrityChecker integrityChecker;
    private final AuditLogBuffer logBuffer;
    private final AlarmService alarmService;

    @Override
    public Health health() {
        Health.Builder builder = Health.up();

        builder.withDetail("bufferSize", logBuffer.size());

        var pendingAlarms = alarmService.listAlarmEvents(
                AlarmStatus.PENDING, null, null
        );
        builder.withDetail("pendingAlarms", pendingAlarms.size());

        var criticalAlarms = alarmService.listAlarmEvents(
                null, AlarmLevel.CRITICAL, null
        );
        builder.withDetail("criticalAlarms", criticalAlarms.size());

        return builder.build();
    }
}
