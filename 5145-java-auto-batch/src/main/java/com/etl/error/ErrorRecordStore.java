package com.etl.error;

import com.etl.model.ErrorRecord;
import com.etl.model.ErrorRecord.ErrorStatus;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.function.Consumer;

public class ErrorRecordStore {

    private final ConcurrentLinkedQueue<ErrorRecord> errorRecords = new ConcurrentLinkedQueue<>();

    public void addError(ErrorRecord record) {
        errorRecords.add(record);
    }

    public List<ErrorRecord> getAllErrors() {
        return new ArrayList<>(errorRecords);
    }

    public List<ErrorRecord> getRepairableErrors() {
        List<ErrorRecord> result = new ArrayList<>();
        for (ErrorRecord record : errorRecords) {
            if (record.getStatus() == ErrorStatus.REPAIRABLE) {
                result.add(record);
            }
        }
        return result;
    }

    public void markAsRepaired(String errorId) {
        for (ErrorRecord record : errorRecords) {
            if (record.getId().equals(errorId)) {
                record.setStatus(ErrorStatus.IRREPARABLE);
                break;
            }
        }
    }

    public void reimportRepaired(ErrorRecordStore store, Consumer<Map<String, Object>> reimportCallback) {
        List<ErrorRecord> repairableErrors = store.getRepairableErrors();
        for (ErrorRecord record : repairableErrors) {
            Map<String, Object> editedData = Map.of(
                    "id", record.getId(),
                    "originalData", record.getOriginalData(),
                    "errorType", record.getErrorType(),
                    "errorDescription", record.getErrorDescription(),
                    "lineNumber", record.getLineNumber()
            );
            reimportCallback.accept(editedData);
            store.markAsRepaired(record.getId());
        }
    }

    public int getErrorCount() {
        return errorRecords.size();
    }

    public void clear() {
        errorRecords.clear();
    }
}
