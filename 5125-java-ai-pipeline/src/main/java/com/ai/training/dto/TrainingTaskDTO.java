package com.ai.training.dto;

import com.ai.training.enums.ModelType;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class TrainingTaskDTO {

    @NotBlank(message = "任务名称不能为空")
    private String taskName;

    @NotNull(message = "模型类型不能为空")
    private ModelType modelType;

    private String trainingParams;

    private String datasetSummary;

    private String submitter;

    private String remark;
}
