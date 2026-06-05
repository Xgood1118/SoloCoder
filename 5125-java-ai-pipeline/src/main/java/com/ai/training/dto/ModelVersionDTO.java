package com.ai.training.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

@Data
public class ModelVersionDTO {

    @NotNull(message = "任务ID不能为空")
    private Long taskId;

    private String trainingParams;

    private String datasetSummary;

    private BigDecimal accuracy;

    private BigDecimal loss;

    private BigDecimal precision;

    private BigDecimal recall;

    private BigDecimal f1Score;

    private String modelPath;

    private String createdBy;
}
