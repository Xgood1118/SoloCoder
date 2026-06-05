package com.etl.error;

import com.etl.model.ErrorRecord;
import com.etl.model.ErrorRecord.ErrorStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public class ErrorRecordFactory {

    public static ErrorRecord create(String originalData, String errorType, String errorDescription,
                                     long lineNumber, ErrorStatus status) {
        String id = UUID.randomUUID().toString();
        LocalDateTime createdAt = LocalDateTime.now();
        return new ErrorRecord(id, originalData, errorType, errorDescription, lineNumber, status, createdAt);
    }
}
