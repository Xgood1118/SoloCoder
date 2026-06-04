package com.crm.lead.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.Date;

@Data
public class LeadCreateDTO {

    @NotNull(message = "客户ID不能为空")
    private Long customerId;

    @NotNull(message = "线索来源不能为空")
    private Long sourceId;

    @NotNull(message = "重要程度不能为空")
    private Integer importanceLevel;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private BigDecimal expectedAmount;

    @JsonFormat(pattern = "yyyy-MM-dd", timezone = "GMT+8")
    private Date expectedDealDate;

    @NotNull(message = "省份不能为空")
    private Long provinceId;

    @NotNull(message = "城市不能为空")
    private Long cityId;

    @NotNull(message = "行业编码不能为空")
    private String industryCode;

    private Long createdBy;
}
