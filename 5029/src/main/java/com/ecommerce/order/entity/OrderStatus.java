package com.ecommerce.order.entity;

public enum OrderStatus {
    PENDING_PAYMENT,
    PAID,
    PENDING_SHIPMENT,
    SHIPPED,
    COMPLETED,
    CANCELLED
}
