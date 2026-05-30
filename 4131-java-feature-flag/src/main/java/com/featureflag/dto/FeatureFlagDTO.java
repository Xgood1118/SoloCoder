package com.featureflag.dto;

import com.featureflag.enums.Environment;
import com.featureflag.enums.FeatureFlagStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FeatureFlagDTO {

    private Long id;

    @NotBlank(message = "flagKey cannot be blank")
    private String flagKey;

    @NotBlank(message = "flagName cannot be blank")
    private String flagName;

    private String description;

    private FeatureFlagStatus status;

    @NotBlank(message = "application cannot be blank")
    private String application;

    private Environment environment;

    private String groupName;

    private Boolean defaultValue;

    private Integer cacheExpireSeconds;

    private Integer priority;
}
