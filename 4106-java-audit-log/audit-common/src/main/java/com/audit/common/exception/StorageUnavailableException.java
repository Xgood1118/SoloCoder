package com.audit.common.exception;

public class StorageUnavailableException extends AuditException {

    public StorageUnavailableException(String message) {
        super(503, message);
    }

    public StorageUnavailableException(String message, Throwable cause) {
        super(503, message, cause);
    }
}
