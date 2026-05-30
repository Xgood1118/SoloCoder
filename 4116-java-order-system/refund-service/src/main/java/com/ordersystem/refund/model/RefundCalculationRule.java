package com.ordersystem.refund.model;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class RefundCalculationRule {
    private RefundReason refundReason;
    private String orderType;
    private BigDecimal penaltyRate;

    public RefundCalculationRule() {
    }

    public RefundCalculationRule(RefundReason refundReason, String orderType, BigDecimal penaltyRate) {
        this.refundReason = refundReason;
        this.orderType = orderType;
        this.penaltyRate = penaltyRate;
    }
}
