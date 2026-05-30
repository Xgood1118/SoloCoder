package com.ordersystem.common.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class PaymentSuccessEvent extends ApplicationEvent {

    private final String paymentId;
    private final String orderNo;
    private final String channel;

    public PaymentSuccessEvent(Object source, String paymentId, String orderNo, String channel) {
        super(source);
        this.paymentId = paymentId;
        this.orderNo = orderNo;
        this.channel = channel;
    }
}
