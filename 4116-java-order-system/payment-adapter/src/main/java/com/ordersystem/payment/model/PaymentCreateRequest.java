package com.ordersystem.payment.model;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PaymentCreateRequest {

    private String orderNo;
    private PaymentChannel channel;
    private BigDecimal amount;
    private String subject;
    private Integer expireMinutes;
}
