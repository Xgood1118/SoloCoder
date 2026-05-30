package com.ordersystem.query.model;

import com.ordersystem.domain.model.OrderStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderDetailVO {

    private String orderId;
    private String orderNo;
    private String userId;
    private String orderType;
    private OrderStatus status;
    private BigDecimal totalAmount;
    private BigDecimal payAmount;
    private BigDecimal discountAmount;
    private BigDecimal freightAmount;
    private List<OrderItemVO> items;
    private OrderAddressVO address;
    private OrderDiscountVO discountInfo;
    private PaymentInfoVO paymentInfo;
    private LogisticsInfoVO logisticsInfo;
    private RefundInfoVO refundInfo;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
