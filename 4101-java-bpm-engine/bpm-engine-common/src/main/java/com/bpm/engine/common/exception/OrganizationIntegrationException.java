package com.bpm.engine.common.exception;

public class OrganizationIntegrationException extends BpmEngineException {

    public OrganizationIntegrationException(String errorCode, String errorMessage) {
        super(errorCode, errorMessage);
    }

    public OrganizationIntegrationException(String errorCode, String errorMessage, Throwable cause) {
        super(errorCode, errorMessage, cause);
    }
}
