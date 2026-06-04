package com.oauth2.server.exception;

import com.oauth2.server.common.Result;
import com.oauth2.server.common.ResultCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AuthenticationException.class)
    public Result<Void> handleAuthenticationException(AuthenticationException e) {
        log.error("Authentication error: {}", e.getMessage());
        return Result.error(ResultCode.UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public Result<Void> handleAccessDeniedException(AccessDeniedException e) {
        log.error("Access denied: {}", e.getMessage());
        return Result.error(ResultCode.FORBIDDEN);
    }

    @ExceptionHandler(OAuth2Exception.class)
    public Result<Void> handleOAuth2Exception(OAuth2Exception e) {
        log.error("OAuth2 error: {}", e.getMessage());
        return Result.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(DataPermissionException.class)
    public Result<Void> handleDataPermissionException(DataPermissionException e) {
        log.error("Data permission error: {}", e.getMessage());
        return Result.error(ResultCode.DATA_PERMISSION_DENIED);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .orElse("Parameter validation failed");
        log.error("Validation error: {}", message);
        return Result.error(ResultCode.BAD_REQUEST.getCode(), message);
    }

    @ExceptionHandler(BindException.class)
    public Result<Void> handleBindException(BindException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .orElse("Parameter binding failed");
        log.error("Bind error: {}", message);
        return Result.error(ResultCode.BAD_REQUEST.getCode(), message);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> handleIllegalArgumentException(IllegalArgumentException e) {
        log.error("Illegal argument: {}", e.getMessage());
        return Result.error(ResultCode.BAD_REQUEST.getCode(), e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        log.error("Internal error: {}", e.getMessage(), e);
        return Result.error(ResultCode.INTERNAL_ERROR);
    }
}
