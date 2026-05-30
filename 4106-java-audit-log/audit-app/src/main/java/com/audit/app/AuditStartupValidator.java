package com.audit.app;

import com.audit.storage.StorageHealthChecker;
import com.audit.common.exception.AuditException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class AuditStartupValidator implements ApplicationRunner {

    private final StorageHealthChecker storageHealthChecker;

    @Override
    public void run(ApplicationArguments args) {
        log.info("Running audit system startup validation...");

        boolean allHealthy = storageHealthChecker.isAllHealthy();

        if (!allHealthy) {
            var healthStatus = storageHealthChecker.checkAll();
            log.error("Startup validation failed. Storage health status: {}", healthStatus);
            throw new AuditException(503, "Required storage services are unavailable: " + healthStatus);
        }

        log.info("Startup validation passed. All services healthy.");
    }
}
