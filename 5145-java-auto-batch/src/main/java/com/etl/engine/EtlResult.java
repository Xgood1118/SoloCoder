package com.etl.engine;

import com.etl.model.BatchProgress;
import com.etl.model.ErrorRecord;

import java.util.ArrayList;
import java.util.List;

public class EtlResult {

    private String taskId;
    private boolean success;
    private long totalProcessed;
    private long totalErrors;
    private List<ErrorRecord> errorRecords;
    private long executionTimeMs;
    private BatchProgress batchProgress;

    public EtlResult() {
        this.errorRecords = new ArrayList<>();
    }

    public EtlResult(String taskId, boolean success, long totalProcessed, long totalErrors,
                     List<ErrorRecord> errorRecords, long executionTimeMs, BatchProgress batchProgress) {
        this.taskId = taskId;
        this.success = success;
        this.totalProcessed = totalProcessed;
        this.totalErrors = totalErrors;
        this.errorRecords = errorRecords;
        this.executionTimeMs = executionTimeMs;
        this.batchProgress = batchProgress;
    }

    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public long getTotalProcessed() {
        return totalProcessed;
    }

    public void setTotalProcessed(long totalProcessed) {
        this.totalProcessed = totalProcessed;
    }

    public long getTotalErrors() {
        return totalErrors;
    }

    public void setTotalErrors(long totalErrors) {
        this.totalErrors = totalErrors;
    }

    public List<ErrorRecord> getErrorRecords() {
        return errorRecords;
    }

    public void setErrorRecords(List<ErrorRecord> errorRecords) {
        this.errorRecords = errorRecords;
    }

    public long getExecutionTimeMs() {
        return executionTimeMs;
    }

    public void setExecutionTimeMs(long executionTimeMs) {
        this.executionTimeMs = executionTimeMs;
    }

    public BatchProgress getBatchProgress() {
        return batchProgress;
    }

    public void setBatchProgress(BatchProgress batchProgress) {
        this.batchProgress = batchProgress;
    }
}
