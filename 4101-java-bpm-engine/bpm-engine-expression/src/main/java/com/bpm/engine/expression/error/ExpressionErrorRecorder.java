package com.bpm.engine.expression.error;

import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.util.IdGenerator;
import org.springframework.stereotype.Component;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.List;

@Component
public class ExpressionErrorRecorder {

    private static final int MAX_RECORDS = 1000;

    private final ConcurrentLinkedDeque<ExpressionErrorRecord> errorRecords = new ConcurrentLinkedDeque<>();

    public void record(String expression, ExpressionType type, Exception e) {
        String stackTrace = extractStackTrace(e);
        ExpressionErrorRecord record = new ExpressionErrorRecord(
                IdGenerator.generateId(),
                expression,
                type,
                e.getMessage(),
                stackTrace,
                LocalDateTime.now()
        );
        errorRecords.addFirst(record);
        while (errorRecords.size() > MAX_RECORDS) {
            errorRecords.removeLast();
        }
    }

    public List<ExpressionErrorRecord> getRecentErrors(int count) {
        List<ExpressionErrorRecord> result = new ArrayList<>();
        int i = 0;
        for (ExpressionErrorRecord record : errorRecords) {
            if (i >= count) {
                break;
            }
            result.add(record);
            i++;
        }
        return result;
    }

    public void clear() {
        errorRecords.clear();
    }

    private String extractStackTrace(Exception e) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        e.printStackTrace(pw);
        return sw.toString();
    }
}
