package com.ordersystem.query.model;

import com.ordersystem.domain.model.OrderStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class OrderStatusHistory {

    private String id;
    private String orderNo;
    private OrderStatus fromStatus;
    private OrderStatus toStatus;
    private String operator;
    private String reason;
    private LocalDateTime operatedAt;
}
