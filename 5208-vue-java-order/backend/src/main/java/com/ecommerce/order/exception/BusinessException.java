package com.ecommerce.order.exception;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(String message) {
        this(400, message);
    }

    public static BusinessException orderNotFound() {
        return new BusinessException(404, "订单不存在");
    }

    public static BusinessException invalidStatusTransition() {
        return new BusinessException(409, "订单状态不允许此操作");
    }

    public static BusinessException batchStatusMismatch(String message) {
        return new BusinessException(400, message);
    }
}
