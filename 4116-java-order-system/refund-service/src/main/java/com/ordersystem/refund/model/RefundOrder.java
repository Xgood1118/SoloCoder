package com.ordersystem.refund.model;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("refund_order")
public class RefundOrder {
    private String refundId;
    private String orderNo;
    private String orderItemId;
    private RefundReason refundReason;
    private RefundType refundType;
    private RefundStatus status;
    private BigDecimal originalAmount;
    private BigDecimal refundAmount;
    private BigDecimal penaltyAmount;
    private AuditStatus auditStatus;
    private String auditor;
    private String auditRemark;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
