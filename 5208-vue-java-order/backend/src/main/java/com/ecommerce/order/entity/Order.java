package com.ecommerce.order.entity;

import com.ecommerce.order.enums.OrderStatus;
import com.ecommerce.order.serialize.LongToStringSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order {
    private String id;
    private String orderNo;
    private String userId;
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();
    @JsonSerialize(using = LongToStringSerializer.class)
    private long totalAmount;
    @JsonSerialize(using = LongToStringSerializer.class)
    private long discountAmount;
    @JsonSerialize(using = LongToStringSerializer.class)
    private long shippingFee;
    @JsonSerialize(using = LongToStringSerializer.class)
    private long paidAmount;
    private Address address;
    private OrderStatus status;
    private String remark;
    private String createReason;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
    private LocalDateTime shippedAt;
    private LocalDateTime receivedAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime refundedAt;
    private LocalDateTime expireAt;
    private LogisticsInfo logistics;
    @Builder.Default
    private List<RefundApplication> refundApplications = new ArrayList<>();
    @Builder.Default
    private Map<OrderStatus, LocalDateTime> statusTimestamps = new HashMap<>();
    @Builder.Default
    private List<String> notificationIds = new ArrayList<>();
}
