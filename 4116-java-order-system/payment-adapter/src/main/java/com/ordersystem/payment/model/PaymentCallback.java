package com.ordersystem.payment.model;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class PaymentCallback {

    private String paymentId;
    private String orderNo;
    private PaymentChannel channel;
    private String callbackNo;
    private PaymentStatus status;
    private BigDecimal amount;
    private LocalDateTime callbackTime;
    private Map<String, String> rawParams;
}
