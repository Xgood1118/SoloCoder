package com.bpm.engine.common.exception;

import lombok.Getter;

@Getter
public class BpmEngineException extends RuntimeException {

    private final String errorCode;
    private final String errorMessage;

    public BpmEngineException(String errorCode, String errorMessage) {
        super(errorMessage);
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
    }

    public BpmEngineException(String errorCode, String errorMessage, Throwable cause) {
        super(errorMessage, cause);
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
    }
}
