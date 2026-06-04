package com.crm.lead.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class LeadClaimDTO {

    @NotNull(message = "线索ID不能为空")
    private Long leadId;

    @NotNull(message = "销售人员ID不能为空")
    private Long salespersonId;
}
