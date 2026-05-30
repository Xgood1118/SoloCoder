package com.ordersystem.payment.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("payment_order")
public class PaymentOrder {

    @TableId(type = IdType.ASSIGN_ID)
    private String paymentId;
    private String orderNo;
    private String outTradeNo;
    private PaymentChannel channel;
    private BigDecimal amount;
    private PaymentStatus status;
    private String payUrl;
    private LocalDateTime callbackTime;
    private String callbackNo;
    private LocalDateTime expireTime;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
