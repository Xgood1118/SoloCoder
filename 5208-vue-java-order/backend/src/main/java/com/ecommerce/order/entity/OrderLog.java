package com.ecommerce.order.entity;

import com.ecommerce.order.enums.OrderAction;
import com.ecommerce.order.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderLog {
    private String id;
    private String orderId;
    private String operatorId;
    private String operatorName;
    private OrderAction action;
    private OrderStatus fromStatus;
    private OrderStatus toStatus;
    private LocalDateTime timestamp;
    private String remark;
}
