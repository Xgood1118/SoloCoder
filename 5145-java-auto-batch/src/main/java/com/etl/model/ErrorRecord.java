package com.etl.model;

import java.time.LocalDateTime;

public class ErrorRecord {

    public static enum ErrorStatus {
        REPAIRABLE, IRREPARABLE
    }

    private String id;
    private String originalData;
    private String errorType;
    private String errorDescription;
    private long lineNumber;
    private ErrorStatus status;
    private LocalDateTime createdAt;

    public ErrorRecord() {
    }

    public ErrorRecord(String id, String originalData, String errorType, String errorDescription,
                       long lineNumber, ErrorStatus status, LocalDateTime createdAt) {
        this.id = id;
        this.originalData = originalData;
        this.errorType = errorType;
        this.errorDescription = errorDescription;
        this.lineNumber = lineNumber;
        this.status = status;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getOriginalData() {
        return originalData;
    }

    public void setOriginalData(String originalData) {
        this.originalData = originalData;
    }

    public String getErrorType() {
        return errorType;
    }

    public void setErrorType(String errorType) {
        this.errorType = errorType;
    }

    public String getErrorDescription() {
        return errorDescription;
    }

    public void setErrorDescription(String errorDescription) {
        this.errorDescription = errorDescription;
    }

    public long getLineNumber() {
        return lineNumber;
    }

    public void setLineNumber(long lineNumber) {
        this.lineNumber = lineNumber;
    }

    public ErrorStatus getStatus() {
        return status;
    }

    public void setStatus(ErrorStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
