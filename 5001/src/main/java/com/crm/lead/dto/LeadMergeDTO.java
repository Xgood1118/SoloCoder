package com.crm.lead.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class LeadMergeDTO {

    @NotNull(message = "主线索ID不能为空")
    private Long mainLeadId;

    @NotEmpty(message = "待合并线索ID列表不能为空")
    private List<Long> mergedLeadIds;

    @NotBlank(message = "合并原因不能为空")
    private String mergeReason;

    private Long operatorId;

    private String operatorName;
}
