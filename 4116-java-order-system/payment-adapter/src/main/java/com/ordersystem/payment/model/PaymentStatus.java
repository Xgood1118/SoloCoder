package com.ordersystem.payment.model;

public enum PaymentStatus {
    INIT,
    PAYING,
    SUCCESS,
    FAILED,
    CLOSED,
    REFUNDING,
    REFUNDED
}
