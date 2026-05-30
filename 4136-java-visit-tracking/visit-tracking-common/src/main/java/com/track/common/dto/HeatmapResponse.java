package com.track.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HeatmapResponse {

    private String pageUrl;
    private Integer totalClicks;
    private List<HeatmapPoint> points;
}
