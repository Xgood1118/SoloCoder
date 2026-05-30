package com.bpm.engine.common.exception;

public class ProcessDefinitionException extends BpmEngineException {

    public ProcessDefinitionException(String errorCode, String errorMessage) {
        super(errorCode, errorMessage);
    }

    public ProcessDefinitionException(String errorCode, String errorMessage, Throwable cause) {
        super(errorCode, errorMessage, cause);
    }
}
