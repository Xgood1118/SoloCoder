package com.track.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HeatmapPoint {

    private Double relativeX;
    private Double relativeY;
    private Integer clickCount;
}
