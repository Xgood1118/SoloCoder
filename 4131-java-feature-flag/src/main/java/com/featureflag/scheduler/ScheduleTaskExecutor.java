package com.featureflag.scheduler;

import com.featureflag.cache.FlagCacheManager;
import com.featureflag.entity.ScheduleConfig;
import com.featureflag.repository.FeatureFlagRepository;
import com.featureflag.repository.ScheduleConfigRepository;
import com.featureflag.service.AuditLogService;
import com.featureflag.service.FlagChangeEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduleTaskExecutor {

    private final ScheduleConfigRepository scheduleConfigRepository;
    private final FeatureFlagRepository featureFlagRepository;
    private final FlagCacheManager flagCacheManager;
    private final FlagChangeEventService changeEventService;
    private final AuditLogService auditLogService;

    @Scheduled(cron = "*/1 * * * * *")
    @Transactional
    public void executeScheduledTasks() {
        LocalDateTime now = LocalDateTime.now();
        List<ScheduleConfig> schedules = scheduleConfigRepository.findScheduledToExecute(now);

        for (ScheduleConfig config : schedules) {
            try {
                executeSchedule(config);
            } catch (Exception e) {
                log.error("Failed to execute schedule: {}", config.getId(), e);
            }
        }
    }

    private void executeSchedule(ScheduleConfig config) {
        log.info("Executing schedule: {} for flag: {}", config.getScheduleName(), config.getFeatureFlag().getId());

        var flag = config.getFeatureFlag();
        var oldStatus = flag.getStatus();
        flag.setStatus(config.getTargetStatus());

        featureFlagRepository.save(flag);

        config.setExecuted(true);
        scheduleConfigRepository.save(config);

        flagCacheManager.invalidateFlagCache(flag.getFlagKey());

        auditLogService.logChange(flag.getFlagKey(), flag.getApplication(),
                "SCHEDULE_EXECUTE", "system",
                oldStatus.name(), config.getTargetStatus().name(),
                "Scheduled task executed: " + config.getScheduleName(), null, null);

        changeEventService.publishChangeEvent(flag.getFlagKey(), flag.getApplication(), "SCHEDULE", flag.getVersion());

        log.info("Schedule executed successfully: {}", config.getScheduleName());
    }
}
