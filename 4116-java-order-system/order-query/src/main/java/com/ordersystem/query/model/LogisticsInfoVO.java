package com.ordersystem.query.model;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class LogisticsInfoVO {

    private String logisticsNo;
    private String logisticsCompany;
    private String status;
    private LocalDateTime shippedAt;
    private LocalDateTime receivedAt;
}
