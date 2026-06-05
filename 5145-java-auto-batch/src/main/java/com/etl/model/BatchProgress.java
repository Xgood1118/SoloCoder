package com.etl.model;

import java.time.Duration;
import java.time.LocalDateTime;

public class BatchProgress {

    private String taskId;
    private long currentBatch;
    private long totalBatches;
    private long processedRecords;
    private long totalRecords;
    private LocalDateTime startTime;
    private LocalDateTime lastUpdateTime;
    private String stateFilePath;

    public BatchProgress() {
    }

    public BatchProgress(String taskId, long currentBatch, long totalBatches, long processedRecords,
                         long totalRecords, LocalDateTime startTime, LocalDateTime lastUpdateTime,
                         String stateFilePath) {
        this.taskId = taskId;
        this.currentBatch = currentBatch;
        this.totalBatches = totalBatches;
        this.processedRecords = processedRecords;
        this.totalRecords = totalRecords;
        this.startTime = startTime;
        this.lastUpdateTime = lastUpdateTime;
        this.stateFilePath = stateFilePath;
    }

    public double getSpeed() {
        if (startTime == null || lastUpdateTime == null) {
            return 0.0;
        }
        long seconds = Duration.between(startTime, lastUpdateTime).getSeconds();
        if (seconds <= 0) {
            return 0.0;
        }
        return (double) processedRecords / seconds;
    }

    public long getEstimatedRemainingTime() {
        if (startTime == null || lastUpdateTime == null || processedRecords <= 0) {
            return -1;
        }
        long elapsedSeconds = Duration.between(startTime, lastUpdateTime).getSeconds();
        if (elapsedSeconds <= 0) {
            return -1;
        }
        long remainingRecords = totalRecords - processedRecords;
        if (remainingRecords <= 0) {
            return 0;
        }
        double speed = (double) processedRecords / elapsedSeconds;
        if (speed <= 0) {
            return -1;
        }
        return (long) (remainingRecords / speed);
    }

    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public long getCurrentBatch() {
        return currentBatch;
    }

    public void setCurrentBatch(long currentBatch) {
        this.currentBatch = currentBatch;
    }

    public long getTotalBatches() {
        return totalBatches;
    }

    public void setTotalBatches(long totalBatches) {
        this.totalBatches = totalBatches;
    }

    public long getProcessedRecords() {
        return processedRecords;
    }

    public void setProcessedRecords(long processedRecords) {
        this.processedRecords = processedRecords;
    }

    public long getTotalRecords() {
        return totalRecords;
    }

    public void setTotalRecords(long totalRecords) {
        this.totalRecords = totalRecords;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getLastUpdateTime() {
        return lastUpdateTime;
    }

    public void setLastUpdateTime(LocalDateTime lastUpdateTime) {
        this.lastUpdateTime = lastUpdateTime;
    }

    public String getStateFilePath() {
        return stateFilePath;
    }

    public void setStateFilePath(String stateFilePath) {
        this.stateFilePath = stateFilePath;
    }
}
