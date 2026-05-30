package com.ordersystem.payment.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("payment_record")
public class PaymentRecord {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String orderNo;
    private PaymentChannel channel;
    private BigDecimal amount;
    private String status;
    private LocalDate transDate;
    private LocalDateTime createdAt;
}
