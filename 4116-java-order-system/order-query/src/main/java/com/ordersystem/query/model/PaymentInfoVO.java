package com.ordersystem.query.model;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class PaymentInfoVO {

    private Long paymentId;
    private String channel;
    private BigDecimal amount;
    private String status;
    private LocalDateTime payTime;
}
