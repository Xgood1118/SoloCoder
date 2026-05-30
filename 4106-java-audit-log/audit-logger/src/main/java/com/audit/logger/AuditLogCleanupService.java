package com.audit.logger;

import com.audit.common.enums.StorageType;
import com.audit.common.model.AuditLogEntry;
import com.audit.storage.StorageRouter;
import com.audit.storage.StorageStrategy;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogCleanupService {

    private final StorageRouter storageRouter;
    private final ObjectMapper objectMapper;

    private static final long DEFAULT_RETENTION_DAYS = 90;
    private static final long DEFAULT_MAX_CAPACITY = 1000000;
    private static final String ARCHIVE_DIR = "audit-archive";

    @Scheduled(cron = "0 0 2 * * ?")
    public void scheduledCleanup() {
        log.info("Starting scheduled audit log cleanup");
        Instant cutoffTime = Instant.now().minus(DEFAULT_RETENTION_DAYS, ChronoUnit.DAYS);
        cleanupByTime(cutoffTime);
        cleanupByCapacity(DEFAULT_MAX_CAPACITY);
        log.info("Scheduled audit log cleanup completed");
    }

    public void cleanupByTime(Instant before) {
        log.info("Cleaning up audit logs before: {}", before);
        for (StorageType type : StorageType.values()) {
            try {
                StorageStrategy strategy = storageRouter.getStrategy(type);
                strategy.deleteByTime(before);
                log.info("Cleaned up logs from {} before {}", type, before);
            } catch (Exception e) {
                log.error("Failed to clean up logs from {}: {}", type, e.getMessage());
            }
        }
    }

    public void cleanupByCapacity(long maxCount) {
        log.info("Cleaning up audit logs to keep maximum {} entries", maxCount);
        for (StorageType type : StorageType.values()) {
            try {
                StorageStrategy strategy = storageRouter.getStrategy(type);
                long currentCount = strategy.count();
                if (currentCount > maxCount) {
                    long deleteCount = currentCount - maxCount;
                    strategy.deleteOldest(deleteCount);
                    log.info("Deleted {} oldest logs from {}", deleteCount, type);
                }
            } catch (Exception e) {
                log.error("Failed to clean up logs by capacity from {}: {}", type, e.getMessage());
            }
        }
    }

    public void backup(Instant before) {
        log.info("Backing up audit logs before: {}", before);
        File archiveDir = new File(ARCHIVE_DIR);
        if (!archiveDir.exists()) {
            archiveDir.mkdirs();
        }

        ObjectMapper archiveMapper = objectMapper.copy();
        archiveMapper.registerModule(new JavaTimeModule());
        archiveMapper.enable(SerializationFeature.INDENT_OUTPUT);

        for (StorageType type : StorageType.values()) {
            try {
                StorageStrategy strategy = storageRouter.getStrategy(type);
                List<AuditLogEntry> entries = strategy.findByTimeBefore(before);
                if (entries.isEmpty()) {
                    continue;
                }

                String fileName = "audit-backup-" + type.name().toLowerCase() + "-" + Instant.now().toEpochMilli() + ".json";
                File backupFile = new File(archiveDir, fileName);

                try (FileWriter writer = new FileWriter(backupFile)) {
                    archiveMapper.writeValue(writer, entries);
                }

                log.info("Backed up {} entries from {} to {}", entries.size(), type, backupFile.getAbsolutePath());
            } catch (Exception e) {
                log.error("Failed to backup logs from {}: {}", type, e.getMessage());
            }
        }
    }
}
