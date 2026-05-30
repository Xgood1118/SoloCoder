package com.track.common.service;

import com.track.common.dto.HeatmapResponse;

import java.time.LocalDateTime;

public interface HeatmapQueryService {

    HeatmapResponse getHeatmapData(String pageUrl);

    HeatmapResponse getHeatmapData(String pageUrl, LocalDateTime start, LocalDateTime end);
}
