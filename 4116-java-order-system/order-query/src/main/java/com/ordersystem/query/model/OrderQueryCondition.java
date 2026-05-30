package com.ordersystem.query.model;

import com.ordersystem.domain.model.OrderStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class OrderQueryCondition {

    private String userId;
    private String orderNo;
    private String skuName;
    private String receiverName;
    private OrderStatus status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer page = 1;
    private Integer size = 10;
}
