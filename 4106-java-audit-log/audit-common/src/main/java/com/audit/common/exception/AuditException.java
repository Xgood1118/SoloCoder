package com.audit.common.exception;

public class AuditException extends RuntimeException {

    private final int code;

    public AuditException(String message) {
        super(message);
        this.code = 500;
    }

    public AuditException(int code, String message) {
        super(message);
        this.code = code;
    }

    public AuditException(int code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public int getCode() {
        return code;
    }
}
