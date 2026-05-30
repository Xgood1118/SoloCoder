package com.ordersystem.payment.model;

import lombok.Data;

@Data
public class PaymentCreateResult {

    private String paymentId;
    private String payUrl;
    private String qrCode;
    private PaymentChannel channel;
}
