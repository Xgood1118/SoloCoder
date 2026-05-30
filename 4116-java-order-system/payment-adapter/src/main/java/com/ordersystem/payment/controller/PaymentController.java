package com.ordersystem.payment.controller;

import com.ordersystem.common.model.Result;
import com.ordersystem.payment.adapter.PaymentAdapter;
import com.ordersystem.payment.adapter.PaymentAdapterFactory;
import com.ordersystem.payment.model.PaymentCallback;
import com.ordersystem.payment.model.PaymentChannel;
import com.ordersystem.payment.model.PaymentCreateRequest;
import com.ordersystem.payment.model.PaymentCreateResult;
import com.ordersystem.payment.model.PaymentOrder;
import com.ordersystem.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final PaymentAdapterFactory adapterFactory;

    @PostMapping("/create")
    public Result<PaymentCreateResult> createPayment(@RequestBody PaymentCreateRequest request) {
        PaymentCreateResult result = paymentService.createPayment(request);
        return Result.success(result);
    }

    @PostMapping("/callback/{channel}")
    public Result<Void> callback(@PathVariable String channel, @RequestParam Map<String, String> params) {
        PaymentChannel paymentChannel = PaymentChannel.valueOf(channel.toUpperCase());
        PaymentAdapter adapter = adapterFactory.getAdapter(paymentChannel);
        PaymentCallback callback = adapter.handleCallback(params, paymentChannel);
        paymentService.handleCallback(callback);
        return Result.success();
    }

    @GetMapping("/query/{paymentId}")
    public Result<PaymentOrder> query(@PathVariable String paymentId) {
        PaymentOrder order = paymentService.queryAndConfirm(paymentId);
        return Result.success(order);
    }

    @PostMapping("/close/{paymentId}")
    public Result<Void> close(@PathVariable String paymentId) {
        PaymentOrder order = paymentService.queryAndConfirm(paymentId);
        if (order != null) {
            PaymentAdapter adapter = adapterFactory.getAdapter(order.getChannel());
            adapter.closePayment(paymentId);
        }
        return Result.success();
    }
}
