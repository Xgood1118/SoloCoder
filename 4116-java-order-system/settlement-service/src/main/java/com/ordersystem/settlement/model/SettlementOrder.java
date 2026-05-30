package com.ordersystem.settlement.model;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("settlement_order")
public class SettlementOrder {
    private String settlementId;
    private String merchantId;
    private String billId;
    private BigDecimal amount;
    private SettlementStatus status;
    private String operator;
    private LocalDateTime operatedAt;
    private LocalDateTime createdAt;
}
