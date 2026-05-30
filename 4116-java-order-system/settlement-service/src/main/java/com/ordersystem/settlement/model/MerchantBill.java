package com.ordersystem.settlement.model;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("merchant_bill")
public class MerchantBill {
    private String billId;
    private String merchantId;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private BigDecimal orderAmount;
    private BigDecimal refundAmount;
    private BigDecimal commissionRate;
    private BigDecimal commissionAmount;
    private BigDecimal settlementAmount;
    private BillStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime confirmedAt;
}
