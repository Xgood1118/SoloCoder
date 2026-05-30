package com.bpm.engine.common.exception;

public class TaskOperationException extends BpmEngineException {

    public TaskOperationException(String errorCode, String errorMessage) {
        super(errorCode, errorMessage);
    }

    public TaskOperationException(String errorCode, String errorMessage, Throwable cause) {
        super(errorCode, errorMessage, cause);
    }
}
