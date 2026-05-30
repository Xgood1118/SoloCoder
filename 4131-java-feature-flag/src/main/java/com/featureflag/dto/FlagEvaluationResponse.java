package com.featureflag.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FlagEvaluationResponse {

    private String flagKey;

    private Boolean enabled;

    private String reason;

    private String matchedRule;

    private String grayBatch;

    private Long timestamp;
}
