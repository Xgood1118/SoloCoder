package com.featureflag.health;

import com.featureflag.repository.FeatureFlagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class FeatureFlagHealthIndicator implements HealthIndicator {

    private final FeatureFlagRepository featureFlagRepository;

    @Override
    public Health health() {
        try {
            long count = featureFlagRepository.count();
            return Health.up()
                    .withDetail("featureFlagsCount", count)
                    .build();
        } catch (Exception e) {
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }
}
