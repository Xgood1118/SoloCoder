package com.audit.alarm;

import com.audit.alarm.config.AlarmConfig;
import com.audit.common.enums.AlarmLevel;
import com.audit.common.model.AlarmEvent;
import com.audit.common.model.AlarmRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
@Slf4j
public class AlarmConvergence {

    private final StringRedisTemplate stringRedisTemplate;
    private final AlarmService alarmService;
    private final RabbitTemplate rabbitTemplate;

    private static final String DEDUP_PREFIX = "alarm:dedup:";
    private static final String TRIGGER_PREFIX = "alarm:trigger:";
    private static final String RECOVERY_PREFIX = "alarm:recovery:";

    public boolean shouldSuppress(AlarmEvent event) {
        String dedupKey = DEDUP_PREFIX + event.getRuleId() + ":" + event.getOperatorId();
        String existing = stringRedisTemplate.opsForValue().get(dedupKey);
        if (existing != null) {
            return true;
        }
        String triggerCountKey = TRIGGER_PREFIX + event.getRuleId();
        String countStr = stringRedisTemplate.opsForValue().get(triggerCountKey);
        int count = countStr != null ? Integer.parseInt(countStr) : 0;
        AlarmRule rule = null;
        try {
            rule = alarmService.getRule(event.getRuleId());
        } catch (IllegalArgumentException e) {
            return false;
        }
        int maxSuppress = rule.getMaxSuppressCount() > 0 ? rule.getMaxSuppressCount() : 10;
        return count >= maxSuppress;
    }

    public void recordTrigger(AlarmEvent event) {
        String dedupKey = DEDUP_PREFIX + event.getRuleId() + ":" + event.getOperatorId();
        AlarmRule rule = null;
        try {
            rule = alarmService.getRule(event.getRuleId());
        } catch (IllegalArgumentException e) {
            stringRedisTemplate.opsForValue().set(dedupKey, event.getId(), 300, TimeUnit.SECONDS);
            return;
        }
        int suppressWindow = rule.getSuppressWindowSeconds() > 0 ? rule.getSuppressWindowSeconds() : 300;
        stringRedisTemplate.opsForValue().set(dedupKey, event.getId(), suppressWindow, TimeUnit.SECONDS);

        String triggerCountKey = TRIGGER_PREFIX + event.getRuleId();
        stringRedisTemplate.opsForValue().increment(triggerCountKey);
        stringRedisTemplate.expire(triggerCountKey, suppressWindow * 2L, TimeUnit.SECONDS);
    }

    public void checkRecovery(String ruleId) {
        String triggerCountKey = TRIGGER_PREFIX + ruleId;
        String countStr = stringRedisTemplate.opsForValue().get(triggerCountKey);
        int count = countStr != null ? Integer.parseInt(countStr) : 0;

        String recoveryKey = RECOVERY_PREFIX + ruleId;
        String lastCheck = stringRedisTemplate.opsForValue().get(recoveryKey);

        if (count == 0 && lastCheck == null) {
            stringRedisTemplate.opsForValue().set(recoveryKey, Instant.now().toString(), 3600, TimeUnit.SECONDS);
            AlarmEvent recoveryEvent = AlarmEvent.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .ruleId(ruleId)
                    .alarmLevel(AlarmLevel.NORMAL)
                    .description("Alarm condition recovered for rule: " + ruleId)
                    .triggeredAt(Instant.now())
                    .suppressCount(0)
                    .build();
            rabbitTemplate.convertAndSend(AlarmConfig.ALARM_EXCHANGE, AlarmConfig.ALARM_RECOVERY_ROUTING_KEY, recoveryEvent);
        } else if (count > 0) {
            stringRedisTemplate.delete(recoveryKey);
        }
    }
}
