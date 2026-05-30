package com.ordersystem.common.event;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class RefundCompletedEvent extends DomainEvent {

    private final String refundId;
    private final String orderNo;
    private final BigDecimal refundAmount;

    public RefundCompletedEvent(String refundId, String orderNo, BigDecimal refundAmount) {
        super(refundId, "REFUND_COMPLETED");
        this.refundId = refundId;
        this.orderNo = orderNo;
        this.refundAmount = refundAmount;
    }
}
