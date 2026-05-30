package com.bpm.engine.expression.error;

import com.bpm.engine.common.enums.ExpressionType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExpressionErrorRecord {

    private String id;
    private String expression;
    private ExpressionType type;
    private String errorMessage;
    private String stackTrace;
    private LocalDateTime timestamp;
}
