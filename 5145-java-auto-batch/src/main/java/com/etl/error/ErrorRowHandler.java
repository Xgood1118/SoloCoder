package com.etl.error;

import com.etl.model.ErrorRecord;
import com.etl.model.ErrorRecord.ErrorStatus;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.DateTimeException;
import java.util.HashMap;
import java.util.Map;

public class ErrorRowHandler {

    private static final Logger logger = LoggerFactory.getLogger(ErrorRowHandler.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final boolean skipOnError;
    private final ErrorRecordStore errorStore;

    public ErrorRowHandler(boolean skipOnError, ErrorRecordStore errorStore) {
        this.skipOnError = skipOnError;
        this.errorStore = errorStore;
    }

    public boolean handleException(Map<String, Object> originalRecord, Exception e, long lineNumber) {
        String originalData;
        try {
            originalData = objectMapper.writeValueAsString(originalRecord);
        } catch (JsonProcessingException ex) {
            originalData = originalRecord.toString();
        }

        String errorType = e.getClass().getSimpleName();
        String errorDescription = e.getMessage();
        ErrorStatus status = determineStatus(e);

        ErrorRecord record = ErrorRecordFactory.create(originalData, errorType, errorDescription, lineNumber, status);
        errorStore.addError(record);

        logger.warn("Error at line {}: [{}] {} - status: {}", lineNumber, errorType, errorDescription, status);

        return skipOnError;
    }

    public boolean handleException(Object[] originalRow, Exception e, long lineNumber) {
        Map<String, Object> map = new HashMap<>();
        for (int i = 0; i < originalRow.length; i++) {
            map.put("col_" + i, originalRow[i]);
        }
        return handleException(map, e, lineNumber);
    }

    private ErrorStatus determineStatus(Exception e) {
        if (e instanceof NumberFormatException || e instanceof DateTimeException) {
            return ErrorStatus.REPAIRABLE;
        }
        return ErrorStatus.IRREPARABLE;
    }
}
