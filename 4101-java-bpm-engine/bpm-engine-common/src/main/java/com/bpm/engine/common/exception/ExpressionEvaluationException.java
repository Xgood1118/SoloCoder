package com.bpm.engine.common.exception;

public class ExpressionEvaluationException extends BpmEngineException {

    public ExpressionEvaluationException(String errorCode, String errorMessage) {
        super(errorCode, errorMessage);
    }

    public ExpressionEvaluationException(String errorCode, String errorMessage, Throwable cause) {
        super(errorCode, errorMessage, cause);
    }
}
