package com.ordersystem.query.model;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class RefundInfoVO {

    private Long refundId;
    private String status;
    private BigDecimal refundAmount;
    private String refundReason;
    private LocalDateTime applyTime;
}
