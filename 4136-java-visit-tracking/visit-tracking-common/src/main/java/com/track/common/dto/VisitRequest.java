package com.track.common.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisitRequest {

    @NotBlank
    private String sessionId;

    @NotBlank
    private String pageUrl;

    @NotNull
    private Long timestamp;

    private String referrer;

    private String userId;

    private String viewportSize;
}
