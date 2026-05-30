package com.ordersystem.common.event;

import lombok.Getter;

@Getter
public class OrderCreatedEvent extends DomainEvent {

    private final String orderId;
    private final String userId;
    private final String orderType;

    public OrderCreatedEvent(String orderId, String userId, String orderType) {
        super(orderId, "ORDER_CREATED");
        this.orderId = orderId;
        this.userId = userId;
        this.orderType = orderType;
    }
}
