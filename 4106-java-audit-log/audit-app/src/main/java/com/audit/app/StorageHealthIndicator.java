package com.audit.app;

import com.audit.storage.StorageHealthChecker;
import com.audit.common.enums.StorageType;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component("storage")
@RequiredArgsConstructor
public class StorageHealthIndicator implements HealthIndicator {

    private final StorageHealthChecker storageHealthChecker;

    @Override
    public Health health() {
        Map<StorageType, Boolean> status = storageHealthChecker.checkAll();
        Health.Builder builder = storageHealthChecker.isAllHealthy() ? Health.up() : Health.down();

        status.forEach((type, healthy) -> builder.withDetail(type.name(), healthy ? "UP" : "DOWN"));

        return builder.build();
    }
}
