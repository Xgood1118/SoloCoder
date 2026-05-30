package com.ordersystem.domain.model;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.domain.statemachine.OrderStateMachine;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    private static final OrderStateMachine STATE_MACHINE = new OrderStateMachine();

    private String orderId;
    private String orderNo;
    private String userId;
    private OrderType orderType;
    private OrderStatus status;
    private BigDecimal totalAmount;
    private BigDecimal payAmount;
    private BigDecimal discountAmount;
    private BigDecimal freightAmount;
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();
    private OrderAddress address;
    private OrderDiscountInfo discountInfo;
    private String merchantId;
    private String remark;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long version;

    public static Order create(String orderId, String orderNo, String userId, String merchantId, OrderType orderType,
                               List<OrderItem> items, OrderAddress address,
                               OrderDiscountInfo discountInfo, String remark) {
        BigDecimal totalAmount = items.stream()
                .map(OrderItem::getSubTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal discountAmount = BigDecimal.ZERO;
        if (discountInfo != null) {
            if (discountInfo.getCouponAmount() != null) {
                discountAmount = discountAmount.add(discountInfo.getCouponAmount());
            }
            if (discountInfo.getPointAmount() != null) {
                discountAmount = discountAmount.add(discountInfo.getPointAmount());
            }
            if (discountInfo.getPromotionAmount() != null) {
                discountAmount = discountAmount.add(discountInfo.getPromotionAmount());
            }
        }

        LocalDateTime now = LocalDateTime.now();
        return Order.builder()
                .orderId(orderId)
                .orderNo(orderNo)
                .userId(userId)
                .merchantId(merchantId)
                .orderType(orderType)
                .status(OrderStatus.PENDING_PAYMENT)
                .totalAmount(totalAmount)
                .payAmount(totalAmount.subtract(discountAmount))
                .discountAmount(discountAmount)
                .freightAmount(BigDecimal.ZERO)
                .items(items)
                .address(address)
                .discountInfo(discountInfo)
                .remark(remark)
                .createdAt(now)
                .updatedAt(now)
                .version(0L)
                .build();
    }

    public void pay() {
        transitTo(OrderStatus.PAID);
        this.updatedAt = LocalDateTime.now();
    }

    public void ship() {
        transitTo(OrderStatus.SHIPPED);
        this.updatedAt = LocalDateTime.now();
    }

    public void receive() {
        transitTo(OrderStatus.RECEIVED);
        this.updatedAt = LocalDateTime.now();
    }

    public void complete() {
        transitTo(OrderStatus.COMPLETED);
        this.updatedAt = LocalDateTime.now();
    }

    public void cancel() {
        if (this.status != OrderStatus.PENDING_PAYMENT && this.status != OrderStatus.PAID) {
            throw new BizException(CommonErrorCode.ORDER_STATUS_ERROR,
                    "当前状态 " + this.status.getDesc() + " 不允许取消");
        }
        transitTo(OrderStatus.CANCELLED);
        this.updatedAt = LocalDateTime.now();
    }

    public void applyRefund() {
        if (this.status != OrderStatus.PAID && this.status != OrderStatus.SHIPPED
                && this.status != OrderStatus.RECEIVED) {
            throw new BizException(CommonErrorCode.ORDER_STATUS_ERROR,
                    "当前状态 " + this.status.getDesc() + " 不允许申请退款");
        }
        transitTo(OrderStatus.REFUNDING);
        this.updatedAt = LocalDateTime.now();
    }

    public void refund() {
        transitTo(OrderStatus.REFUNDED);
        this.updatedAt = LocalDateTime.now();
    }

    public void archive() {
        transitTo(OrderStatus.ARCHIVED);
        this.updatedAt = LocalDateTime.now();
    }

    public BigDecimal getItemAmount(String itemId) {
        return items.stream()
                .filter(item -> item.getItemId().equals(itemId))
                .map(OrderItem::getSubTotalAmount)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    private void transitTo(OrderStatus target) {
        this.status = STATE_MACHINE.transit(this.status, target);
    }
}
