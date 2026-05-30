package com.track.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageVisitInfo {

    private String pageUrl;
    private String referrer;
    private LocalDateTime enterTime;
    private LocalDateTime leaveTime;
    private Long durationSeconds;
}
