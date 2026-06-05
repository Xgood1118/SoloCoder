package com.ai.training.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class ApprovalDTO {

    @NotNull(message = "任务ID不能为空")
    private Long taskId;

    @NotNull(message = "模型版本ID不能为空")
    private Long modelVersionId;

    private String approvalComment;

    @NotNull(message = "操作人不能为空")
    private String approver;

    private String applicant;
}
