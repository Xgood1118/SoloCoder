package com.audit.alarm;

import com.audit.alarm.config.AlarmConfig;
import com.audit.common.enums.AlarmLevel;
import com.audit.common.enums.AlarmStatus;
import com.audit.common.enums.OperationResult;
import com.audit.common.model.AlarmEvent;
import com.audit.common.model.AlarmRule;
import com.audit.common.model.AuditLogEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlarmEngine {

    private final AlarmService alarmService;
    private final AlarmConvergence alarmConvergence;
    private final AlarmNotifier alarmNotifier;
    private final RabbitTemplate rabbitTemplate;
    private final StringRedisTemplate stringRedisTemplate;

    private static final String LOGIN_FAILURE_PREFIX = "alarm:login_failure:";
    private static final String CONDITION_TYPE_CONSECUTIVE_LOGIN_FAILURE = "CONSECUTIVE_LOGIN_FAILURE";
    private static final String CONDITION_TYPE_LARGE_AMOUNT_CHANGE = "LARGE_AMOUNT_CHANGE";
    private static final String CONDITION_TYPE_SENSITIVE_OPERATION = "SENSITIVE_OPERATION";
    private static final String SENSITIVE_RESOURCE_PREFIX = "secret,credential,certificate,key,password,token";

    private volatile List<AlarmRule> cachedRules;
    private volatile long lastRuleLoadTime = 0;
    private static final long RULE_CACHE_TTL_MS = 60_000;

    public void evaluate(AuditLogEntry entry) {
        List<AlarmRule> rules = loadRules();
        for (AlarmRule rule : rules) {
            if (evaluateCondition(entry, rule)) {
                AlarmEvent event = buildAlarmEvent(entry, rule);
                if (alarmConvergence.shouldSuppress(event)) {
                    alarmConvergence.recordTrigger(event);
                    alarmService.updateAlarmEventSuppressed(event.getId());
                    continue;
                }
                alarmConvergence.recordTrigger(event);
                alarmService.saveAlarmEvent(event);
                rabbitTemplate.convertAndSend(AlarmConfig.ALARM_EXCHANGE, AlarmConfig.ALARM_ROUTING_KEY, event);
                alarmNotifier.notify(event);
                alarmConvergence.checkRecovery(rule.getId());
            }
        }
    }

    public List<AlarmRule> loadRules() {
        long now = System.currentTimeMillis();
        if (cachedRules == null || (now - lastRuleLoadTime) > RULE_CACHE_TTL_MS) {
            cachedRules = alarmService.listRules().stream()
                    .filter(AlarmRule::isEnabled)
                    .toList();
            lastRuleLoadTime = now;
        }
        return cachedRules;
    }

    public void refreshRules() {
        lastRuleLoadTime = 0;
    }

    private boolean evaluateCondition(AuditLogEntry entry, AlarmRule rule) {
        return switch (rule.getConditionType()) {
            case CONDITION_TYPE_CONSECUTIVE_LOGIN_FAILURE -> evaluateConsecutiveLoginFailure(entry, rule);
            case CONDITION_TYPE_LARGE_AMOUNT_CHANGE -> evaluateLargeAmountChange(entry, rule);
            case CONDITION_TYPE_SENSITIVE_OPERATION -> evaluateSensitiveOperation(entry, rule);
            default -> false;
        };
    }

    private boolean evaluateConsecutiveLoginFailure(AuditLogEntry entry, AlarmRule rule) {
        if (!"LOGIN".equalsIgnoreCase(entry.getAction()) || entry.getResult() != OperationResult.FAILURE) {
            return false;
        }
        String key = LOGIN_FAILURE_PREFIX + entry.getOperatorId();
        long windowSeconds = rule.getWindowSeconds() > 0 ? rule.getWindowSeconds() : 600;
        long count = stringRedisTemplate.opsForList().size(key);
        stringRedisTemplate.opsForList().rightPush(key, entry.getTimestamp().toString());
        stringRedisTemplate.expire(key, windowSeconds, TimeUnit.SECONDS);
        String oldestStr = stringRedisTemplate.opsForList().index(key, 0);
        if (oldestStr != null) {
            Instant oldest = Instant.parse(oldestStr);
            Instant windowStart = Instant.now().minusSeconds(windowSeconds);
            while (oldest.isBefore(windowStart)) {
                stringRedisTemplate.opsForList().leftPop(key);
                oldestStr = stringRedisTemplate.opsForList().index(key, 0);
                if (oldestStr == null) break;
                oldest = Instant.parse(oldestStr);
            }
        }
        count = stringRedisTemplate.opsForList().size(key);
        int threshold = rule.getThreshold() > 0 ? rule.getThreshold() : 5;
        return count >= threshold;
    }

    private boolean evaluateLargeAmountChange(AuditLogEntry entry, AlarmRule rule) {
        if (entry.getAfterData() == null || entry.getAfterData().isEmpty()) {
            return false;
        }
        try {
            double amount = Double.parseDouble(entry.getAfterData().replaceAll("[^0-9.-]", ""));
            int threshold = rule.getThreshold() > 0 ? rule.getThreshold() : 10000;
            return amount > threshold;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private boolean evaluateSensitiveOperation(AuditLogEntry entry, AlarmRule rule) {
        String resourceType = entry.getResourceType();
        if (resourceType == null) {
            return false;
        }
        String lowerResource = resourceType.toLowerCase();
        return SENSITIVE_RESOURCE_PREFIX.contains(lowerResource)
                || (rule.getConditionExpression() != null
                && !rule.getConditionExpression().isEmpty()
                && lowerResource.matches(rule.getConditionExpression()));
    }

    private AlarmEvent buildAlarmEvent(AuditLogEntry entry, AlarmRule rule) {
        Map<String, String> context = new HashMap<>();
        context.put("sourceLogId", entry.getId() != null ? entry.getId() : "");
        context.put("operatorId", entry.getOperatorId() != null ? entry.getOperatorId() : "");
        context.put("operatorIp", entry.getOperatorIp() != null ? entry.getOperatorIp() : "");
        context.put("action", entry.getAction() != null ? entry.getAction() : "");
        context.put("resourceType", entry.getResourceType() != null ? entry.getResourceType() : "");
        context.put("conditionType", rule.getConditionType());

        return AlarmEvent.builder()
                .id(UUID.randomUUID().toString())
                .ruleId(rule.getId())
                .ruleName(rule.getName())
                .alarmLevel(rule.getAlarmLevel())
                .status(AlarmStatus.PENDING)
                .description(buildDescription(entry, rule))
                .sourceLogId(entry.getId())
                .operatorId(entry.getOperatorId())
                .operatorIp(entry.getOperatorIp())
                .triggeredAt(Instant.now())
                .suppressCount(0)
                .context(context)
                .build();
    }

    private String buildDescription(AuditLogEntry entry, AlarmRule rule) {
        return switch (rule.getConditionType()) {
            case CONDITION_TYPE_CONSECUTIVE_LOGIN_FAILURE ->
                    String.format("Consecutive login failure alarm: operator=%s, rule=%s",
                            entry.getOperatorId(), rule.getName());
            case CONDITION_TYPE_LARGE_AMOUNT_CHANGE ->
                    String.format("Large amount change alarm: operator=%s, resource=%s, rule=%s",
                            entry.getOperatorId(), entry.getResourceType(), rule.getName());
            case CONDITION_TYPE_SENSITIVE_OPERATION ->
                    String.format("Sensitive operation alarm: operator=%s, resource=%s, action=%s, rule=%s",
                            entry.getOperatorId(), entry.getResourceType(), entry.getAction(), rule.getName());
            default -> String.format("Alarm triggered: rule=%s", rule.getName());
        };
    }
}
