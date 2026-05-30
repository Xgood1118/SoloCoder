package com.featureflag.service;

import com.featureflag.cache.FlagCacheManager;
import com.featureflag.dto.FeatureFlagDTO;
import com.featureflag.entity.FeatureFlag;
import com.featureflag.enums.Environment;
import com.featureflag.repository.FeatureFlagRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FeatureFlagManagementService {

    private final FeatureFlagRepository featureFlagRepository;
    private final FlagCacheManager flagCacheManager;
    private final FlagChangeEventService changeEventService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public FeatureFlag getFlag(Long id) {
        return featureFlagRepository.findById(id).orElse(null);
    }

    public FeatureFlag getFlagByKey(String flagKey, String application, Environment environment) {
        return featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(flagKey, application, environment).orElse(null);
    }

    public List<FeatureFlag> getFlagsByApplication(String application, Environment environment) {
        if (environment != null) {
            return featureFlagRepository.findByApplicationAndEnvironment(application, environment);
        }
        return featureFlagRepository.findByApplication(application);
    }

    public List<FeatureFlag> getFlagsByGroup(String groupName) {
        return featureFlagRepository.findByGroupName(groupName);
    }

    @Transactional
    public FeatureFlag createFlag(FeatureFlagDTO dto, String operator) {
        FeatureFlag flag = new FeatureFlag();
        mapDtoToEntity(dto, flag);
        flag.setCreatedBy(operator);
        flag.setUpdatedBy(operator);

        if (featureFlagRepository.existsByFlagKeyAndApplicationAndEnvironment(
                flag.getFlagKey(), flag.getApplication(), flag.getEnvironment())) {
            throw new IllegalArgumentException("Flag already exists with same key, application and environment");
        }

        FeatureFlag saved = featureFlagRepository.save(flag);

        auditLogService.logChange(saved.getFlagKey(), saved.getApplication(),
                "CREATE", operator, null, toJson(saved), "Created new feature flag", null, null);

        changeEventService.publishChangeEvent(saved.getFlagKey(), saved.getApplication(), "CREATE", saved.getVersion());

        return saved;
    }

    @Transactional
    public FeatureFlag updateFlag(Long id, FeatureFlagDTO dto, String operator) {
        FeatureFlag flag = featureFlagRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + id));

        String oldValue = toJson(flag);

        mapDtoToEntity(dto, flag);
        flag.setUpdatedBy(operator);

        FeatureFlag saved = featureFlagRepository.save(flag);

        flagCacheManager.invalidateFlagCache(saved.getFlagKey());

        auditLogService.logChange(saved.getFlagKey(), saved.getApplication(),
                "UPDATE", operator, oldValue, toJson(saved), "Updated feature flag", null, null);

        changeEventService.publishChangeEvent(saved.getFlagKey(), saved.getApplication(), "UPDATE", saved.getVersion());

        return saved;
    }

    @Transactional
    public void deleteFlag(Long id, String operator) {
        FeatureFlag flag = featureFlagRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + id));

        String oldValue = toJson(flag);

        featureFlagRepository.delete(flag);

        flagCacheManager.invalidateFlagCache(flag.getFlagKey());

        auditLogService.logChange(flag.getFlagKey(), flag.getApplication(),
                "DELETE", operator, oldValue, null, "Deleted feature flag", null, null);

        changeEventService.publishChangeEvent(flag.getFlagKey(), flag.getApplication(), "DELETE", flag.getVersion());
    }

    @Transactional
    public FeatureFlag toggleFlag(Long id, boolean enabled, String operator) {
        FeatureFlag flag = featureFlagRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + id));

        String oldValue = toJson(flag);
        com.featureflag.enums.FeatureFlagStatus oldStatus = flag.getStatus();

        flag.setStatus(enabled ? com.featureflag.enums.FeatureFlagStatus.ON : com.featureflag.enums.FeatureFlagStatus.OFF);
        flag.setUpdatedBy(operator);

        FeatureFlag saved = featureFlagRepository.save(flag);

        flagCacheManager.invalidateFlagCache(saved.getFlagKey());

        auditLogService.logChange(saved.getFlagKey(), saved.getApplication(),
                "TOGGLE", operator, oldValue, toJson(saved),
                "Toggled flag from " + oldStatus + " to " + flag.getStatus(), null, null);

        changeEventService.publishChangeEvent(saved.getFlagKey(), saved.getApplication(), "TOGGLE", saved.getVersion());

        return saved;
    }

    private void mapDtoToEntity(FeatureFlagDTO dto, FeatureFlag entity) {
        entity.setFlagKey(dto.getFlagKey());
        entity.setFlagName(dto.getFlagName());
        entity.setDescription(dto.getDescription());
        if (dto.getStatus() != null) {
            entity.setStatus(dto.getStatus());
        }
        entity.setApplication(dto.getApplication());
        if (dto.getEnvironment() != null) {
            entity.setEnvironment(dto.getEnvironment());
        }
        entity.setGroupName(dto.getGroupName());
        if (dto.getDefaultValue() != null) {
            entity.setDefaultValue(dto.getDefaultValue());
        }
        if (dto.getCacheExpireSeconds() != null) {
            entity.setCacheExpireSeconds(dto.getCacheExpireSeconds());
        }
        if (dto.getPriority() != null) {
            entity.setPriority(dto.getPriority());
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize object to JSON", e);
            return null;
        }
    }
}
