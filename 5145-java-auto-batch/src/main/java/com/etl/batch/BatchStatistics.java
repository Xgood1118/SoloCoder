package com.etl.batch;

import java.util.concurrent.atomic.AtomicLong;

public class BatchStatistics {

    private final long startTime;
    private final AtomicLong processedRecords;
    private final long totalRecords;

    public BatchStatistics(long startTime, long totalRecords) {
        this.startTime = startTime;
        this.processedRecords = new AtomicLong(0);
        this.totalRecords = totalRecords;
    }

    public double getSpeed() {
        long elapsed = (System.currentTimeMillis() - startTime) / 1000;
        if (elapsed <= 0) {
            return 0.0;
        }
        return (double) processedRecords.get() / elapsed;
    }

    public long getEstimatedRemainingTime() {
        long elapsed = (System.currentTimeMillis() - startTime) / 1000;
        if (elapsed <= 0 || processedRecords.get() <= 0) {
            return -1;
        }
        long remaining = totalRecords - processedRecords.get();
        if (remaining <= 0) {
            return 0;
        }
        double speed = (double) processedRecords.get() / elapsed;
        if (speed <= 0) {
            return -1;
        }
        return (long) (remaining / speed);
    }

    public double getProgressPercentage() {
        if (totalRecords <= 0) {
            return 0.0;
        }
        return (double) processedRecords.get() / totalRecords * 100;
    }

    public String getFormattedStats() {
        long processed = processedRecords.get();
        double speed = getSpeed();
        long eta = getEstimatedRemainingTime();
        double percentage = getProgressPercentage();
        String etaStr = eta < 0 ? "N/A" : eta + "s";
        return String.format("Processed: %d/%d, Speed: %.0f records/s, ETA: %s, Progress: %.1f%%",
                processed, totalRecords, speed, etaStr, percentage);
    }

    public void addProcessed(long count) {
        processedRecords.addAndGet(count);
    }

    public long getProcessedRecords() {
        return processedRecords.get();
    }

    public long getTotalRecords() {
        return totalRecords;
    }
}
