package com.ordersystem.refund.service;

import com.ordersystem.inventory.service.InventoryService;
import com.ordersystem.refund.model.RefundOrder;
import com.ordersystem.refund.repository.RefundOrderRepository;
import com.ordersystem.refund.model.*;
import com.ordersystem.refund.config.RefundConfig;
import com.ordersystem.common.event.RefundAppliedEvent;
import com.ordersystem.common.event.RefundCompletedEvent;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.repository.OrderRepository;
import com.ordersystem.payment.adapter.PaymentAdapter;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class RefundService {

    private final RefundOrderRepository refundOrderRepository;
    private final RefundCalculator refundCalculator;
    private final RefundCompensationService compensationService;
    private final RefundConfig refundConfig;
    private final ApplicationEventPublisher eventPublisher;
    private final OrderRepository orderRepository;
    private final PaymentAdapter paymentAdapter;

    public RefundService(RefundOrderRepository refundOrderRepository,
                         RefundCalculator refundCalculator,
                         RefundCompensationService compensationService,
                         RefundConfig refundConfig,
                         ApplicationEventPublisher eventPublisher,
                         OrderRepository orderRepository,
                         PaymentAdapter paymentAdapter) {
        this.refundOrderRepository = refundOrderRepository;
        this.refundCalculator = refundCalculator;
        this.compensationService = compensationService;
        this.refundConfig = refundConfig;
        this.eventPublisher = eventPublisher;
        this.orderRepository = orderRepository;
        this.paymentAdapter = paymentAdapter;
    }

    @Transactional
    public RefundOrder applyRefund(RefundApplyRequest request) {
        validateRefundCondition(request);

        Order order = orderRepository.findByOrderNo(request.getOrderNo())
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + request.getOrderNo()));
        BigDecimal originalAmount = resolveOriginalAmount(order, request);

        BigDecimal refundAmount;
        BigDecimal penaltyAmount;

        if (request.getRefundType() == RefundType.PARTIAL && request.getRefundAmount() != null) {
            penaltyAmount = refundCalculator.calculatePenaltyAmount(request.getRefundAmount(), request.getRefundReason(), order.getOrderType().name());
            refundAmount = request.getRefundAmount().subtract(penaltyAmount);
        } else {
            refundAmount = refundCalculator.calculateRefundAmount(originalAmount, request.getRefundReason(), request.getRefundType(), order.getOrderType().name());
            penaltyAmount = refundCalculator.calculatePenaltyAmount(originalAmount, request.getRefundReason(), order.getOrderType().name());
        }

        AuditStatus auditStatus = refundAmount.compareTo(refundConfig.getAuditThreshold()) > 0
                ? AuditStatus.PENDING_AUDIT
                : AuditStatus.NOT_REQUIRED;

        RefundOrder refundOrder = new RefundOrder();
        refundOrder.setRefundId(UUID.randomUUID().toString());
        refundOrder.setOrderNo(request.getOrderNo());
        refundOrder.setOrderItemId(request.getOrderItemId());
        refundOrder.setRefundReason(request.getRefundReason());
        refundOrder.setRefundType(request.getRefundType());
        refundOrder.setStatus(RefundStatus.PENDING);
        refundOrder.setOriginalAmount(originalAmount);
        refundOrder.setRefundAmount(refundAmount);
        refundOrder.setPenaltyAmount(penaltyAmount);
        refundOrder.setAuditStatus(auditStatus);
        refundOrder.setCreatedAt(LocalDateTime.now());
        refundOrder.setUpdatedAt(LocalDateTime.now());

        refundOrderRepository.insert(refundOrder);

        eventPublisher.publishEvent(new RefundAppliedEvent(refundOrder.getRefundId(), refundOrder.getOrderNo(), refundAmount));

        return refundOrder;
    }

    @Transactional
    public RefundOrder auditRefund(String refundId, boolean approved, String auditor, String remark) {
        RefundOrder refundOrder = refundOrderRepository.findByRefundId(refundId);
        if (refundOrder == null) {
            throw new IllegalArgumentException("Refund order not found: " + refundId);
        }
        if (refundOrder.getAuditStatus() != AuditStatus.PENDING_AUDIT) {
            throw new IllegalStateException("Refund order is not pending audit: " + refundId);
        }

        refundOrder.setAuditor(auditor);
        refundOrder.setAuditRemark(remark);
        refundOrder.setUpdatedAt(LocalDateTime.now());

        if (approved) {
            refundOrder.setAuditStatus(AuditStatus.APPROVED);
            refundOrder.setStatus(RefundStatus.PROCESSING);
        } else {
            refundOrder.setAuditStatus(AuditStatus.REJECTED);
            refundOrder.setStatus(RefundStatus.CLOSED);
        }

        refundOrderRepository.updateById(refundOrder);
        return refundOrder;
    }

    @Transactional
    public RefundOrder executeRefund(String refundId) {
        RefundOrder refundOrder = refundOrderRepository.findByRefundId(refundId);
        if (refundOrder == null) {
            throw new IllegalArgumentException("Refund order not found: " + refundId);
        }
        if (refundOrder.getStatus() != RefundStatus.PENDING && refundOrder.getStatus() != RefundStatus.PROCESSING) {
            throw new IllegalStateException("Refund order cannot be executed in current status: " + refundOrder.getStatus());
        }

        refundOrder.setStatus(RefundStatus.PROCESSING);
        refundOrder.setUpdatedAt(LocalDateTime.now());
        refundOrderRepository.updateById(refundOrder);

        try {
            paymentAdapter.refund(refundOrder.getOrderNo(), refundOrder.getRefundAmount());

            compensationService.rollbackInventory(refundOrder.getOrderNo(), refundOrder.getOrderItemId());

            refundOrder.setStatus(RefundStatus.SUCCESS);
            refundOrder.setUpdatedAt(LocalDateTime.now());
            refundOrderRepository.updateById(refundOrder);

            eventPublisher.publishEvent(new RefundCompletedEvent(refundOrder.getRefundId(), refundOrder.getOrderNo(), refundOrder.getRefundAmount()));
        } catch (Exception e) {
            failRefund(refundId);
            throw new RuntimeException("Refund execution failed", e);
        }

        return refundOrder;
    }

    @Transactional
    public RefundOrder failRefund(String refundId) {
        RefundOrder refundOrder = refundOrderRepository.findByRefundId(refundId);
        if (refundOrder == null) {
            throw new IllegalArgumentException("Refund order not found: " + refundId);
        }

        refundOrder.setStatus(RefundStatus.FAILED);
        refundOrder.setUpdatedAt(LocalDateTime.now());
        refundOrderRepository.updateById(refundOrder);

        return refundOrder;
    }

    public RefundOrder getByRefundId(String refundId) {
        return refundOrderRepository.findByRefundId(refundId);
    }

    public List<RefundOrder> getByOrderNo(String orderNo) {
        return refundOrderRepository.findByOrderNo(orderNo);
    }

    private void validateRefundCondition(RefundApplyRequest request) {
        List<RefundOrder> existing = refundOrderRepository.findByOrderNo(request.getOrderNo());
        boolean hasActive = existing.stream()
                .anyMatch(r -> r.getStatus() == RefundStatus.PENDING || r.getStatus() == RefundStatus.PROCESSING);
        if (hasActive) {
            throw new IllegalStateException("Order already has an active refund request: " + request.getOrderNo());
        }
    }

    private BigDecimal resolveOriginalAmount(Order order, RefundApplyRequest request) {
        if (request.getRefundType() == RefundType.SINGLE_ITEM && request.getOrderItemId() != null) {
            return order.getItemAmount(request.getOrderItemId());
        }
        return order.getTotalAmount();
    }
}
