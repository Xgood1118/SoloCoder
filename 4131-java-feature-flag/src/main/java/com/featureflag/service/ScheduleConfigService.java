package com.featureflag.service;

import com.featureflag.entity.FeatureFlag;
import com.featureflag.entity.ScheduleConfig;
import com.featureflag.repository.FeatureFlagRepository;
import com.featureflag.repository.ScheduleConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleConfigService {

    private final ScheduleConfigRepository scheduleConfigRepository;
    private final FeatureFlagRepository featureFlagRepository;

    public List<ScheduleConfig> getSchedulesByFlag(Long flagId) {
        return scheduleConfigRepository.findByFeatureFlagId(flagId);
    }

    public List<ScheduleConfig> getActiveSchedules(Long flagId) {
        return scheduleConfigRepository.findActiveSchedules(flagId, LocalDateTime.now());
    }

    @Transactional
    public ScheduleConfig createSchedule(Long flagId, ScheduleConfig config, String operator) {
        FeatureFlag flag = featureFlagRepository.findById(flagId)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + flagId));

        config.setFeatureFlag(flag);
        config.setCreatedBy(operator);
        config.setExecuted(false);

        return scheduleConfigRepository.save(config);
    }

    @Transactional
    public ScheduleConfig updateSchedule(Long scheduleId, ScheduleConfig config) {
        ScheduleConfig existing = scheduleConfigRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found: " + scheduleId));

        existing.setScheduleName(config.getScheduleName());
        existing.setCronExpression(config.getCronExpression());
        existing.setTargetStatus(config.getTargetStatus());
        existing.setEffectiveTime(config.getEffectiveTime());
        existing.setExpireTime(config.getExpireTime());
        existing.setEnabled(config.getEnabled());

        return scheduleConfigRepository.save(existing);
    }

    @Transactional
    public void deleteSchedule(Long scheduleId) {
        scheduleConfigRepository.deleteById(scheduleId);
    }

    @Transactional
    public void toggleSchedule(Long scheduleId, boolean enabled) {
        ScheduleConfig config = scheduleConfigRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found: " + scheduleId));
        config.setEnabled(enabled);
        scheduleConfigRepository.save(config);
    }
}
