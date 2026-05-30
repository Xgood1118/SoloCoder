package com.ordersystem.settlement.model;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ordersystem.payment.model.PaymentChannel;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("reconciliation_record")
public class ReconciliationRecord {
    private Long id;
    private String orderNo;
    private PaymentChannel channel;
    private BigDecimal systemAmount;
    private BigDecimal channelAmount;
    private BigDecimal diffAmount;
    private ReconcileStatus status;
    private ReconcileDiffType diffType;
    private LocalDateTime reconciledAt;
    private LocalDateTime createdAt;
}
