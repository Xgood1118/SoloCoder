package com.bpm.engine.common.exception;

public class ProcessExecutionException extends BpmEngineException {

    public ProcessExecutionException(String errorCode, String errorMessage) {
        super(errorCode, errorMessage);
    }

    public ProcessExecutionException(String errorCode, String errorMessage, Throwable cause) {
        super(errorCode, errorMessage, cause);
    }
}
