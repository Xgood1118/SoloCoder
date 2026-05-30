package com.track.path;

import com.track.common.dto.HeatmapPoint;
import com.track.common.dto.HeatmapResponse;
import com.track.common.entity.ClickEvent;
import com.track.common.repository.ClickEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class HeatmapQueryService implements com.track.common.service.HeatmapQueryService {

    private static final int GRID_SIZE = 100;
    private static final double CELL_SIZE = 0.01;

    private final ClickEventRepository clickEventRepository;

    public HeatmapResponse getHeatmapData(String pageUrl) {
        List<ClickEvent> clicks = clickEventRepository.findByPageUrl(pageUrl);
        return buildHeatmapResponse(pageUrl, clicks);
    }

    public HeatmapResponse getHeatmapData(String pageUrl, LocalDateTime start, LocalDateTime end) {
        List<ClickEvent> clicks = clickEventRepository.findByPageUrlAndTimestampBetween(pageUrl, start, end);
        return buildHeatmapResponse(pageUrl, clicks);
    }

    private HeatmapResponse buildHeatmapResponse(String pageUrl, List<ClickEvent> clicks) {
        Map<String, Integer> grid = new HashMap<>();

        for (ClickEvent click : clicks) {
            int cellX = Math.min((int) (click.getRelativeX() / CELL_SIZE), GRID_SIZE - 1);
            int cellY = Math.min((int) (click.getRelativeY() / CELL_SIZE), GRID_SIZE - 1);
            String key = cellX + "," + cellY;
            grid.merge(key, 1, Integer::sum);
        }

        List<HeatmapPoint> points = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : grid.entrySet()) {
            String[] parts = entry.getKey().split(",");
            int cellX = Integer.parseInt(parts[0]);
            int cellY = Integer.parseInt(parts[1]);
            double centerX = (cellX + 0.5) * CELL_SIZE;
            double centerY = (cellY + 0.5) * CELL_SIZE;
            points.add(new HeatmapPoint(centerX, centerY, entry.getValue()));
        }

        return new HeatmapResponse(pageUrl, clicks.size(), points);
    }
}
