package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("refund_record")
public class RefundRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long leadId;

    private Long customerId;

    private String orderNo;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private BigDecimal refundAmount;

    private String refundReason;

    private String negotiationProcess;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date refundTime;

    private Long operatorId;

    private String operatorName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;
}
