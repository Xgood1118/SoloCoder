package com.ordersystem.common.event;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class RefundAppliedEvent extends DomainEvent {

    private final String refundId;
    private final String orderNo;
    private final BigDecimal refundAmount;

    public RefundAppliedEvent(String refundId, String orderNo, BigDecimal refundAmount) {
        super(refundId, "REFUND_APPLIED");
        this.refundId = refundId;
        this.orderNo = orderNo;
        this.refundAmount = refundAmount;
    }
}
