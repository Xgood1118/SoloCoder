package com.ordersystem.common.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum CommonErrorCode implements ErrorCode {

    SUCCESS(0, "成功"),
    PARAM_ERROR(400, "参数错误"),
    NOT_FOUND(404, "资源不存在"),
    DUPLICATE_REQUEST(409, "重复请求"),
    INSUFFICIENT_STOCK(1001, "库存不足"),
    PAYMENT_FAILED(1002, "支付失败"),
    PAYMENT_TIMEOUT(1003, "支付超时"),
    ORDER_STATUS_ERROR(1004, "订单状态异常"),
    REFUND_FAILED(1005, "退款失败"),
    DUPLICATE_PAYMENT(1006, "重复支付"),
    SYSTEM_ERROR(500, "系统错误");

    private final int code;
    private final String message;

    @Override
    public int code() {
        return code;
    }

    @Override
    public String message() {
        return message;
    }
}
