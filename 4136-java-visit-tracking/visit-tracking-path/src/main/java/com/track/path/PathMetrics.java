package com.track.path;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PathMetrics {

    private String pageUrl;
    private long totalVisits;
    private double bounceRate;
    private double exitRate;
    private double avgDurationSeconds;
    private double avgDepth;
}
