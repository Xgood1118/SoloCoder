package com.track.common.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HeartbeatRequest {

    @NotBlank
    private String sessionId;

    @NotBlank
    private String pageUrl;

    @NotNull
    private Long timestamp;
}
