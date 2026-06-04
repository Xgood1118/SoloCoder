package com.oauth2.server.exception;

public class DataPermissionException extends RuntimeException {

    public DataPermissionException(String message) {
        super(message);
    }

    public DataPermissionException(String message, Throwable cause) {
        super(message, cause);
    }
}
