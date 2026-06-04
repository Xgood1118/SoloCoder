package com.ecommerce.order.service;

import com.ecommerce.inventory.service.InventoryService;
import com.ecommerce.order.dto.OrderCreateRequest;
import com.ecommerce.order.dto.OrderStatusChangeRequest;
import com.ecommerce.order.entity.Order;
import com.ecommerce.order.entity.OrderItem;
import com.ecommerce.order.entity.OrderStatus;
import com.ecommerce.order.entity.OrderStatusLog;
import com.ecommerce.order.repository.OrderRepository;
import com.ecommerce.order.repository.OrderStatusLogRepository;
import com.ecommerce.product.entity.Sku;
import com.ecommerce.product.repository.SkuRepository;
import com.ecommerce.promotion.dto.PromotionCalculateRequest;
import com.ecommerce.promotion.dto.PromotionCalculateResult;
import com.ecommerce.promotion.service.PromotionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderStatusLogRepository orderStatusLogRepository;
    private final InventoryService inventoryService;
    private final PromotionService promotionService;
    private final SkuRepository skuRepository;

    @Transactional
    public Order createOrder(OrderCreateRequest request) {
        Order order = new Order();
        order.setOrderNo(generateOrderNo());
        order.setCustomerName(request.getCustomerName());
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setCouponCode(request.getCouponCode());

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<LockedItem> lockedItems = new ArrayList<>();

        try {
            for (OrderCreateRequest.OrderItemRequest itemReq : request.getItems()) {
                Sku sku = skuRepository.findById(itemReq.getSkuId())
                        .orElseThrow(() -> new IllegalArgumentException("SKU not found: " + itemReq.getSkuId()));

                BigDecimal unitPrice = sku.getPrice();
                BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
                totalAmount = totalAmount.add(subtotal);

                OrderItem orderItem = new OrderItem();
                orderItem.setSkuId(itemReq.getSkuId());
                orderItem.setProductId(itemReq.getProductId());
                orderItem.setQuantity(itemReq.getQuantity());
                orderItem.setUnitPrice(unitPrice);
                orderItem.setSubtotal(subtotal);
                order.addItem(orderItem);

                inventoryService.lockStockWithDistributedLock(itemReq.getSkuId(), itemReq.getQuantity());
                lockedItems.add(new LockedItem(itemReq.getSkuId(), itemReq.getQuantity()));
            }
        } catch (Exception e) {
            for (LockedItem locked : lockedItems) {
                try {
                    inventoryService.rollbackStock(locked.skuId, locked.quantity);
                } catch (Exception rollbackEx) {
                    log.error("Failed to rollback stock for skuId={}, quantity={}", locked.skuId, locked.quantity, rollbackEx);
                }
            }
            throw e;
        }

        order.setTotalAmount(totalAmount);

        PromotionCalculateResult promoResult = calculatePromotions(order, request.getCouponCode());
        order.setDiscountAmount(promoResult.getTotalDiscount());
        order.setPayAmount(totalAmount.subtract(promoResult.getTotalDiscount()));

        recordStatusChange(order, null, OrderStatus.PENDING_PAYMENT, "SYSTEM", "Order created");

        Order savedOrder = orderRepository.save(order);
        log.info("Order created: orderNo={}, totalAmount={}, payAmount={}",
                savedOrder.getOrderNo(), savedOrder.getTotalAmount(), savedOrder.getPayAmount());

        return savedOrder;
    }

    @Transactional
    public Order payOrder(Long orderId, OrderStatusChangeRequest.StatusChange request) {
        Order order = getOrder(orderId);
        validateStatusTransition(order.getStatus(), OrderStatus.PAID);

        changeStatus(order, OrderStatus.PAID, request.getChangedBy(), request.getRemark());
        return orderRepository.save(order);
    }

    @Transactional
    public Order confirmPayment(Long orderId, OrderStatusChangeRequest.StatusChange request) {
        Order order = getOrder(orderId);
        validateStatusTransition(order.getStatus(), OrderStatus.PENDING_SHIPMENT);

        changeStatus(order, OrderStatus.PENDING_SHIPMENT, request.getChangedBy(), request.getRemark());
        return orderRepository.save(order);
    }

    @Transactional
    public Order shipOrder(Long orderId, OrderStatusChangeRequest.StatusChange request) {
        Order order = getOrder(orderId);
        validateStatusTransition(order.getStatus(), OrderStatus.SHIPPED);

        for (OrderItem item : order.getItems()) {
            inventoryService.deductStock(item.getSkuId(), item.getQuantity());
        }

        changeStatus(order, OrderStatus.SHIPPED, request.getChangedBy(), request.getRemark());
        return orderRepository.save(order);
    }

    @Transactional
    public Order completeOrder(Long orderId, OrderStatusChangeRequest.StatusChange request) {
        Order order = getOrder(orderId);
        validateStatusTransition(order.getStatus(), OrderStatus.COMPLETED);

        changeStatus(order, OrderStatus.COMPLETED, request.getChangedBy(), request.getRemark());
        return orderRepository.save(order);
    }

    @Transactional
    public Order cancelOrder(Long orderId, OrderStatusChangeRequest.StatusChange request) {
        Order order = getOrder(orderId);

        if (order.getStatus() == OrderStatus.COMPLETED) {
            throw new IllegalStateException("Cannot cancel a completed order");
        }

        if (order.getStatus() == OrderStatus.PENDING_PAYMENT
                || order.getStatus() == OrderStatus.PAID
                || order.getStatus() == OrderStatus.PENDING_SHIPMENT) {
            for (OrderItem item : order.getItems()) {
                inventoryService.rollbackStock(item.getSkuId(), item.getQuantity());
            }
        } else if (order.getStatus() == OrderStatus.SHIPPED) {
            for (OrderItem item : order.getItems()) {
                inventoryService.returnStock(item.getSkuId(), item.getQuantity());
            }
        }

        if (order.getCouponCode() != null && !order.getCouponCode().isBlank()) {
            try {
                rollbackCouponUsage(order.getCouponCode());
            } catch (Exception e) {
                log.warn("Failed to rollback coupon usage: {}", order.getCouponCode(), e);
            }
        }

        changeStatus(order, OrderStatus.CANCELLED, request.getChangedBy(), request.getRemark());
        return orderRepository.save(order);
    }

    public Order getOrder(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + id));
    }

    public Order getOrderByNo(String orderNo) {
        return orderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNo));
    }

    public List<Order> listOrders() {
        return orderRepository.findAll();
    }

    public List<Order> listOrdersByStatus(OrderStatus status) {
        return orderRepository.findByStatus(status);
    }

    public List<OrderStatusLog> getOrderStatusLogs(Long orderId) {
        return orderStatusLogRepository.findByOrderIdOrderByChangedAtAsc(orderId);
    }

    private void validateStatusTransition(OrderStatus current, OrderStatus target) {
        boolean valid = switch (target) {
            case PAID -> current == OrderStatus.PENDING_PAYMENT;
            case PENDING_SHIPMENT -> current == OrderStatus.PAID;
            case SHIPPED -> current == OrderStatus.PENDING_SHIPMENT;
            case COMPLETED -> current == OrderStatus.SHIPPED;
            case CANCELLED -> current == OrderStatus.PENDING_PAYMENT
                    || current == OrderStatus.PAID
                    || current == OrderStatus.PENDING_SHIPMENT
                    || current == OrderStatus.SHIPPED;
            default -> false;
        };

        if (!valid) {
            throw new IllegalStateException(
                    "Invalid status transition from " + current + " to " + target);
        }
    }

    private void changeStatus(Order order, OrderStatus newStatus, String changedBy, String remark) {
        OrderStatus oldStatus = order.getStatus();
        order.setStatus(newStatus);
        recordStatusChange(order, oldStatus, newStatus, changedBy, remark);
    }

    private void recordStatusChange(Order order, OrderStatus from, OrderStatus to, String changedBy, String remark) {
        OrderStatusLog log = new OrderStatusLog();
        log.setFromStatus(from);
        log.setToStatus(to);
        log.setChangedAt(LocalDateTime.now());
        log.setChangedBy(changedBy);
        log.setRemark(remark);
        order.addStatusLog(log);
    }

    private PromotionCalculateResult calculatePromotions(Order order, String couponCode) {
        PromotionCalculateRequest promoRequest = new PromotionCalculateRequest();

        List<PromotionCalculateRequest.OrderItemInfo> itemInfos = order.getItems().stream()
                .map(item -> {
                    PromotionCalculateRequest.OrderItemInfo info = new PromotionCalculateRequest.OrderItemInfo();
                    info.setProductId(item.getProductId());
                    info.setSkuId(item.getSkuId());
                    info.setQuantity(item.getQuantity());
                    info.setUnitPrice(item.getUnitPrice());
                    info.setSubtotal(item.getSubtotal());
                    return info;
                })
                .toList();

        promoRequest.setItems(itemInfos);
        promoRequest.setCouponCode(couponCode);

        return promotionService.calculatePromotions(promoRequest);
    }

    private void rollbackCouponUsage(String couponCode) {
        com.ecommerce.promotion.entity.Coupon coupon = promotionService.getCouponByCode(couponCode);
        coupon.setUsedQuantity(Math.max(0, coupon.getUsedQuantity() - 1));
    }

    private String generateOrderNo() {
        return "ORD" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private record LockedItem(Long skuId, Integer quantity) {
    }
}
