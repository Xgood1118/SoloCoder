package com.ai.training.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class CheckpointDTO {

    @NotNull(message = "任务ID不能为空")
    private Long taskId;

    @NotBlank(message = "checkpoint路径不能为空")
    private String checkpointPath;

    private String gpuNode;
}
