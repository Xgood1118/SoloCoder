package com.crm.lead.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.Date;

@Data
public class RefundRecordDTO {

    @NotNull(message = "线索ID不能为空")
    private Long leadId;

    @NotNull(message = "客户ID不能为空")
    private Long customerId;

    @NotBlank(message = "订单编号不能为空")
    private String orderNo;

    @NotNull(message = "退款金额不能为空")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private BigDecimal refundAmount;

    @NotBlank(message = "退款原因不能为空")
    private String refundReason;

    private String negotiationProcess;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date refundTime;

    private Long operatorId;

    private String operatorName;
}
