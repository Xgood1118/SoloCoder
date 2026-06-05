package com.etl.batch;

import com.etl.model.BatchProgress;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;

public class BatchProcessor {

    private static final Logger logger = LoggerFactory.getLogger(BatchProcessor.class);

    private final int batchSize;
    private final int memoryLimitMB;
    private final AtomicLong currentBatch = new AtomicLong(0);
    private final AtomicLong processedRecords = new AtomicLong(0);
    private final AtomicLong totalRecords = new AtomicLong(0);
    private long startTime;
    private BatchProgress progress;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public BatchProcessor() {
        this(10000, 512);
    }

    public BatchProcessor(int batchSize, int memoryLimitMB) {
        this.batchSize = batchSize;
        this.memoryLimitMB = memoryLimitMB;
    }

    public void start(String taskId, long estimatedTotal) {
        startTime = System.currentTimeMillis();
        totalRecords.set(estimatedTotal);
        processedRecords.set(0);
        currentBatch.set(0);
        progress = new BatchProgress();
        progress.setTaskId(taskId);
        progress.setTotalRecords(estimatedTotal);
        progress.setProcessedRecords(0);
        progress.setCurrentBatch(0);
        progress.setStartTime(LocalDateTime.now());
        progress.setLastUpdateTime(LocalDateTime.now());
    }

    public boolean shouldStartNewBatch(int currentBatchSize) {
        return currentBatchSize >= batchSize;
    }

    public void beforeBatch() {
        checkMemory();
    }

    public void afterBatch(long processedInBatch) {
        processedRecords.addAndGet(processedInBatch);
        currentBatch.incrementAndGet();
        if (progress != null) {
            progress.setLastUpdateTime(LocalDateTime.now());
            progress.setProcessedRecords(processedRecords.get());
            progress.setCurrentBatch(currentBatch.get());
        }
    }

    public BatchProgress getProgress() {
        return progress;
    }

    public void saveProgress(String stateFilePath) {
        try {
            if (progress != null) {
                progress.setStateFilePath(stateFilePath);
            }
            objectMapper.writeValue(new File(stateFilePath), progress);
        } catch (Exception e) {
            logger.error("Failed to save progress to {}", stateFilePath, e);
            throw new RuntimeException("Failed to save progress", e);
        }
    }

    public BatchProgress loadProgress(String stateFilePath) {
        try {
            return objectMapper.readValue(new File(stateFilePath), BatchProgress.class);
        } catch (Exception e) {
            logger.error("Failed to load progress from {}", stateFilePath, e);
            throw new RuntimeException("Failed to load progress", e);
        }
    }

    public boolean hasProgress(String stateFilePath) {
        return new File(stateFilePath).exists();
    }

    private void checkMemory() {
        long usedMemoryMB = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
        if (usedMemoryMB > memoryLimitMB) {
            logger.warn("Memory usage {}MB exceeds limit {}MB, triggering GC", usedMemoryMB, memoryLimitMB);
            System.gc();
            usedMemoryMB = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
            if (usedMemoryMB > memoryLimitMB) {
                throw new RuntimeException("Memory usage " + usedMemoryMB + "MB still exceeds limit " + memoryLimitMB + "MB after GC");
            }
        }
    }
}
