package com.ai.training.dto;

import com.ai.training.entity.ModelVersion;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class VersionCompareResult {

    private ModelVersion version1;

    private ModelVersion version2;

    private BigDecimal accuracyDiff;

    private BigDecimal lossDiff;

    private BigDecimal precisionDiff;

    private BigDecimal recallDiff;

    private BigDecimal f1ScoreDiff;
}
