package com.audit.common.exception;

public class QueryInjectionException extends AuditException {

    public QueryInjectionException(String message) {
        super(400, message);
    }
}
