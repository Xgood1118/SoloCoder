package com.audit.storage;

import com.audit.common.enums.StorageType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class StorageHealthChecker {

    private final List<StorageStrategy> strategies;

    public Map<StorageType, Boolean> checkAll() {
        Map<StorageType, Boolean> healthMap = new EnumMap<>(StorageType.class);
        for (StorageStrategy strategy : strategies) {
            boolean healthy = false;
            try {
                healthy = strategy.isHealthy();
            } catch (Exception e) {
                log.error("Health check failed for {}: {}", strategy.getType(), e.getMessage());
            }
            healthMap.put(strategy.getType(), healthy);
        }
        return healthMap;
    }

    public boolean isAllHealthy() {
        Map<StorageType, Boolean> healthMap = checkAll();
        return !healthMap.isEmpty() && healthMap.values().stream().allMatch(Boolean::booleanValue);
    }
}
