package com.ecommerce.order.enums;

import com.fasterxml.jackson.annotation.JsonValue;

public enum OrderStatus {
    PENDING_PAYMENT("待支付"),
    PAID("已支付"),
    SHIPPED("已发货"),
    RECEIVED("已收货"),
    REFUNDED("已退款"),
    CANCELLED("已取消");

    private final String description;

    OrderStatus(String description) {
        this.description = description;
    }

    @JsonValue
    public String getDescription() {
        return description;
    }

    public String getName() {
        return this.name();
    }

    public boolean canTransitionTo(OrderStatus target) {
        if (this == target) return true;
        
        switch (this) {
            case PENDING_PAYMENT:
                return target == PAID || target == CANCELLED || target == REFUNDED;
            case PAID:
                return target == SHIPPED || target == REFUNDED;
            case SHIPPED:
                return target == RECEIVED || target == REFUNDED;
            case RECEIVED:
                return target == REFUNDED;
            case REFUNDED:
            case CANCELLED:
                return false;
            default:
                return false;
        }
    }
}
