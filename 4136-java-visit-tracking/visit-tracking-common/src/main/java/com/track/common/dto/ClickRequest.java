package com.track.common.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClickRequest {

    @NotBlank
    private String sessionId;

    @NotBlank
    private String pageUrl;

    private String elementId;

    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("1.0")
    private Double relativeX;

    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("1.0")
    private Double relativeY;

    private Integer viewportWidth;

    private Integer viewportHeight;

    @NotNull
    private Long timestamp;
}
