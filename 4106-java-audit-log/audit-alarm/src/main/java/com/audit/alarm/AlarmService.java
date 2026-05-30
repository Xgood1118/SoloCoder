package com.audit.alarm;

import com.audit.common.enums.AlarmLevel;
import com.audit.common.enums.AlarmStatus;
import com.audit.common.model.AlarmEvent;
import com.audit.common.model.AlarmRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlarmService {

    private final Map<String, AlarmRule> ruleStore = new ConcurrentHashMap<>();
    private final Map<String, AlarmEvent> eventStore = new ConcurrentHashMap<>();

    public AlarmRule createRule(AlarmRule rule) {
        if (rule.getId() == null || rule.getId().isEmpty()) {
            rule.setId(java.util.UUID.randomUUID().toString());
        }
        ruleStore.put(rule.getId(), rule);
        return rule;
    }

    public AlarmRule updateRule(String ruleId, AlarmRule rule) {
        AlarmRule existing = ruleStore.get(ruleId);
        if (existing == null) {
            throw new IllegalArgumentException("Rule not found: " + ruleId);
        }
        rule.setId(ruleId);
        ruleStore.put(ruleId, rule);
        return rule;
    }

    public void deleteRule(String ruleId) {
        if (!ruleStore.containsKey(ruleId)) {
            throw new IllegalArgumentException("Rule not found: " + ruleId);
        }
        ruleStore.remove(ruleId);
    }

    public AlarmRule getRule(String ruleId) {
        AlarmRule rule = ruleStore.get(ruleId);
        if (rule == null) {
            throw new IllegalArgumentException("Rule not found: " + ruleId);
        }
        return rule;
    }

    public List<AlarmRule> listRules() {
        return new ArrayList<>(ruleStore.values());
    }

    public void saveAlarmEvent(AlarmEvent event) {
        eventStore.put(event.getId(), event);
    }

    public void updateAlarmEventSuppressed(String eventId) {
        AlarmEvent event = eventStore.get(eventId);
        if (event != null) {
            event.setSuppressCount(event.getSuppressCount() + 1);
            event.setLastSuppressedAt(Instant.now());
            event.setStatus(AlarmStatus.SUPPRESSED);
            eventStore.put(event.getId(), event);
        }
    }

    public AlarmEvent getAlarmEvent(String eventId) {
        AlarmEvent event = eventStore.get(eventId);
        if (event == null) {
            throw new IllegalArgumentException("Alarm event not found: " + eventId);
        }
        return event;
    }

    public List<AlarmEvent> listAlarmEvents(AlarmStatus status, AlarmLevel level, String operatorId) {
        return eventStore.values().stream()
                .filter(e -> status == null || e.getStatus() == status)
                .filter(e -> level == null || e.getAlarmLevel() == level)
                .filter(e -> operatorId == null || operatorId.isEmpty() || operatorId.equals(e.getOperatorId()))
                .collect(Collectors.toList());
    }

    public AlarmEvent resolveAlarm(String eventId, String resolvedBy) {
        AlarmEvent event = getAlarmEvent(eventId);
        event.setStatus(AlarmStatus.RESOLVED);
        event.setResolvedAt(Instant.now());
        event.setResolvedBy(resolvedBy);
        eventStore.put(event.getId(), event);
        return event;
    }

    public AlarmEvent suppressAlarm(String eventId) {
        AlarmEvent event = getAlarmEvent(eventId);
        event.setStatus(AlarmStatus.SUPPRESSED);
        event.setSuppressCount(event.getSuppressCount() + 1);
        event.setLastSuppressedAt(Instant.now());
        eventStore.put(event.getId(), event);
        return event;
    }

    public AlarmEvent confirmAlarm(String eventId) {
        AlarmEvent event = getAlarmEvent(eventId);
        event.setStatus(AlarmStatus.CONFIRMED);
        eventStore.put(event.getId(), event);
        return event;
    }

    public void initDefaultRules() {
        if (!ruleStore.isEmpty()) {
            return;
        }

        AlarmRule loginFailureRule = AlarmRule.builder()
                .id("rule-consecutive-login-failure")
                .name("Consecutive Login Failure")
                .description("Triggers when 5 consecutive login failures occur within 10 minutes")
                .enabled(true)
                .conditionType("CONSECUTIVE_LOGIN_FAILURE")
                .threshold(5)
                .windowSeconds(600)
                .alarmLevel(AlarmLevel.CRITICAL)
                .autoActions(List.of("LOCK_ACCOUNT", "BLOCK_IP"))
                .notifyTargets(List.of("ADMIN", "SECURITY_TEAM"))
                .suppressWindowSeconds(300)
                .maxSuppressCount(10)
                .build();

        AlarmRule largeAmountRule = AlarmRule.builder()
                .id("rule-large-amount-change")
                .name("Large Amount Change")
                .description("Triggers when a data change involves an amount exceeding the threshold")
                .enabled(true)
                .conditionType("LARGE_AMOUNT_CHANGE")
                .threshold(10000)
                .windowSeconds(0)
                .alarmLevel(AlarmLevel.CRITICAL)
                .autoActions(List.of("NOTIFY_ADMIN"))
                .notifyTargets(List.of("ADMIN", "FINANCE_TEAM"))
                .suppressWindowSeconds(600)
                .maxSuppressCount(5)
                .build();

        AlarmRule sensitiveOperationRule = AlarmRule.builder()
                .id("rule-sensitive-operation")
                .name("Sensitive Operation")
                .description("Triggers when an operation targets a sensitive resource")
                .enabled(true)
                .conditionType("SENSITIVE_OPERATION")
                .conditionExpression("secret|credential|certificate|key|password|token")
                .threshold(1)
                .windowSeconds(0)
                .alarmLevel(AlarmLevel.NORMAL)
                .autoActions(List.of())
                .notifyTargets(List.of("ADMIN"))
                .suppressWindowSeconds(1800)
                .maxSuppressCount(20)
                .build();

        ruleStore.put(loginFailureRule.getId(), loginFailureRule);
        ruleStore.put(largeAmountRule.getId(), largeAmountRule);
        ruleStore.put(sensitiveOperationRule.getId(), sensitiveOperationRule);
    }
}
