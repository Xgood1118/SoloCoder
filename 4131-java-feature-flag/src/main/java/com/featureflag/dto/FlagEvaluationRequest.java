package com.featureflag.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FlagEvaluationRequest {

    @NotBlank(message = "flagKey cannot be blank")
    private String flagKey;

    @NotBlank(message = "application cannot be blank")
    private String application;

    private String environment;

    private UserContext userContext;

    private Boolean defaultValue = false;
}
