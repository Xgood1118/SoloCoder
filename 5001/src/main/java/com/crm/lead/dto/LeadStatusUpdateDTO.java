package com.crm.lead.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class LeadStatusUpdateDTO {

    @NotNull(message = "线索ID不能为空")
    private Long leadId;

    @NotBlank(message = "新状态不能为空")
    private String newStatus;

    @NotBlank(message = "变更原因不能为空")
    private String changeReason;

    private String remark;

    private Long operatorId;

    private String operatorName;
}
