package com.track.path;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PathNode {

    private String pageUrl;
    private LocalDateTime enterTime;
    private LocalDateTime leaveTime;
    private String referrer;
    private String nextPageUrl;
    private Long durationSeconds;
    private boolean outOfOrder;
}
