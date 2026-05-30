package com.ordersystem.payment.adapter;

import com.ordersystem.payment.model.PaymentCallback;
import com.ordersystem.payment.model.PaymentChannel;
import com.ordersystem.payment.model.PaymentCreateRequest;
import com.ordersystem.payment.model.PaymentCreateResult;
import com.ordersystem.payment.model.PaymentOrder;

import java.math.BigDecimal;
import java.util.Map;

public interface PaymentAdapter {

    PaymentCreateResult createPayment(PaymentCreateRequest request);

    PaymentOrder queryPayment(String paymentId);

    PaymentCallback handleCallback(Map<String, String> params, PaymentChannel channel);

    boolean refund(String paymentId, BigDecimal amount);

    boolean closePayment(String paymentId);
}
