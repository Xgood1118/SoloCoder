package com.ai.training.dto;

import com.ai.training.enums.TrainingStatus;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class RollbackDTO {

    @NotNull(message = "任务ID不能为空")
    private Long taskId;

    @NotNull(message = "目标版本ID不能为空")
    private Long toVersionId;

    @NotNull(message = "目标状态不能为空")
    private TrainingStatus targetStatus;

    @NotBlank(message = "回滚原因不能为空")
    private String rollbackReason;

    @NotBlank(message = "操作人不能为空")
    private String operator;
}
