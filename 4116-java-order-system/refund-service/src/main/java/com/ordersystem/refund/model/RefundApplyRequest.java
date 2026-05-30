package com.ordersystem.refund.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class RefundApplyRequest {
    @NotBlank
    private String orderNo;
    private String orderItemId;
    @NotNull
    private RefundReason refundReason;
    @NotNull
    private RefundType refundType;
    private BigDecimal refundAmount;
}
