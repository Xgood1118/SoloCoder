package com.audit.alarm;

import com.audit.common.enums.AlarmLevel;
import com.audit.common.model.AlarmEvent;
import com.audit.common.model.AlarmRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
@Slf4j
public class AlarmNotifier {

    private final AlarmService alarmService;
    private final StringRedisTemplate stringRedisTemplate;

    private static final String BLOCKED_IP_PREFIX = "alarm:blocked_ip:";
    private static final String LOCKED_ACCOUNT_PREFIX = "alarm:locked_account:";

    public void notify(AlarmEvent event) {
        if (event.getAlarmLevel() == AlarmLevel.CRITICAL) {
            executeAutoActions(event);
            sendImmediateNotification(event);
        } else {
            recordNotification(event);
            sendNotification(event);
        }
    }

    private void executeAutoActions(AlarmEvent event) {
        AlarmRule rule = null;
        try {
            rule = alarmService.getRule(event.getRuleId());
        } catch (IllegalArgumentException e) {
            return;
        }

        List<String> autoActions = rule.getAutoActions();
        if (autoActions == null || autoActions.isEmpty()) {
            return;
        }

        for (String action : autoActions) {
            switch (action.toUpperCase()) {
                case "LOCK_ACCOUNT" -> lockAccount(event.getOperatorId());
                case "BLOCK_IP" -> blockIp(event.getOperatorIp());
                case "NOTIFY_ADMIN" -> sendImmediateNotification(event);
                default -> log.warn("Unknown auto action: {}", action);
            }
        }
    }

    private void lockAccount(String operatorId) {
        if (operatorId == null || operatorId.isEmpty()) {
            return;
        }
        String key = LOCKED_ACCOUNT_PREFIX + operatorId;
        stringRedisTemplate.opsForValue().set(key, Instant.now().toString(), 3600, TimeUnit.SECONDS);
        log.info("Account locked: {}", operatorId);
    }

    private void blockIp(String operatorIp) {
        if (operatorIp == null || operatorIp.isEmpty()) {
            return;
        }
        String key = BLOCKED_IP_PREFIX + operatorIp;
        stringRedisTemplate.opsForValue().set(key, Instant.now().toString(), 3600, TimeUnit.SECONDS);
        log.info("IP blocked: {}", operatorIp);
    }

    private void sendImmediateNotification(AlarmEvent event) {
        log.info("IMMEDIATE NOTIFICATION - Alarm: [{}] Rule: {} Operator: {} IP: {} Description: {}",
                event.getAlarmLevel(), event.getRuleName(), event.getOperatorId(),
                event.getOperatorIp(), event.getDescription());
    }

    private void sendNotification(AlarmEvent event) {
        log.info("Notification - Alarm: [{}] Rule: {} Operator: {} Description: {}",
                event.getAlarmLevel(), event.getRuleName(), event.getOperatorId(),
                event.getDescription());
    }

    private void recordNotification(AlarmEvent event) {
        log.info("Alarm recorded - EventId: {} RuleId: {} Level: {}",
                event.getId(), event.getRuleId(), event.getAlarmLevel());
    }
}
