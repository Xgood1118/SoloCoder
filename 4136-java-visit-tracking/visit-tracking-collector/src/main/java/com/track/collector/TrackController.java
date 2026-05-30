package com.track.collector;

import com.track.common.dto.ApiResponse;
import com.track.common.dto.ClickRequest;
import com.track.common.dto.HeartbeatRequest;
import com.track.common.dto.HeatmapResponse;
import com.track.common.dto.SessionDetailResponse;
import com.track.common.dto.VisitRequest;
import com.track.common.service.HeatmapQueryService;
import com.track.common.service.SessionQueryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/track")
@RequiredArgsConstructor
@Slf4j
public class TrackController {

    private final EventCollectorService eventCollectorService;
    private final SessionQueryService sessionQueryService;
    private final HeatmapQueryService heatmapQueryService;

    @PostMapping("/visit")
    public ResponseEntity<ApiResponse<String>> trackVisit(@RequestBody @Valid VisitRequest request) {
        log.info("Visit event received: sessionId={}, pageUrl={}", request.getSessionId(), request.getPageUrl());
        eventCollectorService.collectVisit(request);
        ApiResponse<String> response = new ApiResponse<>(202, "accepted", "accepted");
        return ResponseEntity.accepted().body(response);
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<ApiResponse<String>> trackHeartbeat(@RequestBody @Valid HeartbeatRequest request) {
        eventCollectorService.collectHeartbeat(request);
        ApiResponse<String> response = new ApiResponse<>(202, "accepted", "accepted");
        return ResponseEntity.accepted().body(response);
    }

    @PostMapping("/click")
    public ResponseEntity<ApiResponse<String>> trackClick(@RequestBody @Valid ClickRequest request) {
        log.info("Click event received: sessionId={}, pageUrl={}", request.getSessionId(), request.getPageUrl());
        eventCollectorService.collectClick(request);
        ApiResponse<String> response = new ApiResponse<>(202, "accepted", "accepted");
        return ResponseEntity.accepted().body(response);
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<ApiResponse<SessionDetailResponse>> getSession(@PathVariable String sessionId) {
        SessionDetailResponse detail = sessionQueryService.getSessionDetail(sessionId);
        ApiResponse<SessionDetailResponse> response = new ApiResponse<>(200, "ok", detail);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/heatmap/{pageUrl}")
    public ResponseEntity<ApiResponse<HeatmapResponse>> getHeatmap(@PathVariable String pageUrl) {
        HeatmapResponse heatmap = heatmapQueryService.getHeatmapData(pageUrl);
        ApiResponse<HeatmapResponse> response = new ApiResponse<>(200, "ok", heatmap);
        return ResponseEntity.ok(response);
    }
}
