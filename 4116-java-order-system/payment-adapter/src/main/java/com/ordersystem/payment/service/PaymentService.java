package com.ordersystem.payment.service;

import com.ordersystem.common.event.PaymentSuccessEvent;
import com.ordersystem.common.exception.BizException;
import com.ordersystem.payment.adapter.PaymentAdapter;
import com.ordersystem.payment.adapter.PaymentAdapterFactory;
import com.ordersystem.payment.model.PaymentCallback;
import com.ordersystem.payment.model.PaymentChannel;
import com.ordersystem.payment.model.PaymentCreateRequest;
import com.ordersystem.payment.model.PaymentCreateResult;
import com.ordersystem.payment.model.PaymentOrder;
import com.ordersystem.payment.model.PaymentStatus;
import com.ordersystem.payment.repository.PaymentOrderRepository;
import cn.hutool.core.util.IdUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentOrderRepository paymentOrderRepository;
    private final PaymentAdapterFactory adapterFactory;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public PaymentCreateResult createPayment(PaymentCreateRequest request) {
        PaymentOrder existingOrder = paymentOrderRepository.findByOrderNo(request.getOrderNo());
        if (existingOrder != null && existingOrder.getStatus() == PaymentStatus.SUCCESS) {
            throw new BizException(500, "订单已支付，请勿重复支付");
        }

        PaymentAdapter adapter = adapterFactory.getAdapter(request.getChannel());
        PaymentCreateResult createResult = adapter.createPayment(request);

        PaymentOrder order = new PaymentOrder();
        order.setPaymentId(createResult.getPaymentId());
        order.setOrderNo(request.getOrderNo());
        order.setOutTradeNo(createResult.getPaymentId());
        order.setChannel(request.getChannel());
        order.setAmount(request.getAmount());
        order.setStatus(PaymentStatus.INIT);
        order.setPayUrl(createResult.getPayUrl());
        order.setExpireTime(LocalDateTime.now().plusMinutes(
                request.getExpireMinutes() != null ? request.getExpireMinutes() : 30));
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        paymentOrderRepository.save(order);

        return createResult;
    }

    @Transactional
    public void handleCallback(PaymentCallback callback) {
        if (paymentOrderRepository.existsByCallbackNo(callback.getCallbackNo())) {
            log.warn("Duplicate callback detected, callbackNo={}", callback.getCallbackNo());
            return;
        }

        PaymentOrder order = paymentOrderRepository.findByPaymentId(callback.getPaymentId());
        if (order == null) {
            throw new BizException(404, "支付订单不存在: " + callback.getPaymentId());
        }

        if (order.getStatus() == PaymentStatus.SUCCESS) {
            log.warn("Payment already success, skip callback. paymentId={}", callback.getPaymentId());
            return;
        }

        order.setStatus(callback.getStatus());
        order.setCallbackNo(callback.getCallbackNo());
        order.setCallbackTime(callback.getCallbackTime());
        order.setUpdatedAt(LocalDateTime.now());
        paymentOrderRepository.save(order);

        if (callback.getStatus() == PaymentStatus.SUCCESS) {
            eventPublisher.publishEvent(new PaymentSuccessEvent(
                    this, order.getPaymentId(), order.getOrderNo(), order.getChannel().name()));
        }
    }

    public PaymentOrder queryAndConfirm(String paymentId) {
        PaymentOrder order = paymentOrderRepository.findByPaymentId(paymentId);
        if (order == null) {
            throw new BizException(404, "支付订单不存在: " + paymentId);
        }

        if (order.getStatus() == PaymentStatus.INIT || order.getStatus() == PaymentStatus.PAYING) {
            PaymentAdapter adapter = adapterFactory.getAdapter(order.getChannel());
            PaymentOrder remoteOrder = adapter.queryPayment(paymentId);
            if (remoteOrder != null && remoteOrder.getStatus() != order.getStatus()) {
                order.setStatus(remoteOrder.getStatus());
                order.setUpdatedAt(LocalDateTime.now());
                paymentOrderRepository.save(order);

                if (order.getStatus() == PaymentStatus.SUCCESS) {
                    eventPublisher.publishEvent(new PaymentSuccessEvent(
                            this, order.getPaymentId(), order.getOrderNo(), order.getChannel().name()));
                }
            }
        }

        return order;
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void closeExpiredPayments() {
        List<PaymentOrder> expiredOrders = paymentOrderRepository.findByStatusAndExpireTimeBefore(
                PaymentStatus.INIT, LocalDateTime.now());
        for (PaymentOrder order : expiredOrders) {
            try {
                PaymentAdapter adapter = adapterFactory.getAdapter(order.getChannel());
                adapter.closePayment(order.getPaymentId());
                order.setStatus(PaymentStatus.CLOSED);
                order.setUpdatedAt(LocalDateTime.now());
                paymentOrderRepository.save(order);
                log.info("Closed expired payment: paymentId={}", order.getPaymentId());
            } catch (Exception e) {
                log.error("Failed to close expired payment: paymentId={}", order.getPaymentId(), e);
            }
        }
    }

    @Transactional
    public void checkDuplicatePayment(String orderNo) {
        List<PaymentOrder> orders = paymentOrderRepository.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<PaymentOrder>()
                        .eq(PaymentOrder::getOrderNo, orderNo)
                        .eq(PaymentOrder::getStatus, PaymentStatus.SUCCESS));

        if (orders.size() > 1) {
            log.warn("Duplicate payment detected for orderNo={}, count={}", orderNo, orders.size());
            PaymentOrder keepOrder = orders.get(0);
            for (int i = 1; i < orders.size(); i++) {
                PaymentOrder duplicate = orders.get(i);
                try {
                    PaymentAdapter adapter = adapterFactory.getAdapter(duplicate.getChannel());
                    boolean refundResult = adapter.refund(duplicate.getPaymentId(), duplicate.getAmount());
                    if (refundResult) {
                        duplicate.setStatus(PaymentStatus.REFUNDING);
                        duplicate.setUpdatedAt(LocalDateTime.now());
                        paymentOrderRepository.save(duplicate);
                        log.info("Auto refund triggered for duplicate payment: paymentId={}", duplicate.getPaymentId());
                    }
                } catch (Exception e) {
                    log.error("Auto refund failed for duplicate payment: paymentId={}", duplicate.getPaymentId(), e);
                }
            }
        }
    }
}
