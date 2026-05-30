package com.audit.api;

import com.audit.alarm.AlarmService;
import com.audit.common.dto.ApiResponse;
import com.audit.common.enums.AlarmLevel;
import com.audit.common.enums.AlarmStatus;
import com.audit.common.model.AlarmEvent;
import com.audit.common.model.AlarmRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audit/alarms")
@RequiredArgsConstructor
@Slf4j
public class AlarmController {

    private final AlarmService alarmService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AlarmEvent>>> listAlarms(
            @RequestParam(required = false) AlarmStatus status,
            @RequestParam(required = false) AlarmLevel level,
            @RequestParam(required = false) String operatorId,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime) {

        List<AlarmEvent> events = alarmService.listAlarmEvents(status, level, operatorId);

        if (startTime != null || endTime != null) {
            events = events.stream()
                    .filter(e -> startTime == null || !e.getTriggeredAt().isBefore(startTime))
                    .filter(e -> endTime == null || !e.getTriggeredAt().isAfter(endTime))
                    .toList();
        }

        return ResponseEntity.ok(ApiResponse.success(events));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AlarmEvent>> getAlarmById(@PathVariable String id) {
        try {
            AlarmEvent event = alarmService.getAlarmEvent(id);
            return ResponseEntity.ok(ApiResponse.success(event));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }

    @PutMapping("/{id}/confirm")
    public ResponseEntity<ApiResponse<AlarmEvent>> confirmAlarm(@PathVariable String id) {
        try {
            AlarmEvent event = alarmService.confirmAlarm(id);
            return ResponseEntity.ok(ApiResponse.success(event));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }

    @PutMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<AlarmEvent>> resolveAlarm(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        try {
            String resolvedBy = body.get("resolvedBy");
            if (resolvedBy == null || resolvedBy.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error(400, "resolvedBy is required"));
            }
            AlarmEvent event = alarmService.resolveAlarm(id, resolvedBy);
            return ResponseEntity.ok(ApiResponse.success(event));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }

    @PutMapping("/{id}/suppress")
    public ResponseEntity<ApiResponse<AlarmEvent>> suppressAlarm(@PathVariable String id) {
        try {
            AlarmEvent event = alarmService.suppressAlarm(id);
            return ResponseEntity.ok(ApiResponse.success(event));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }

    @GetMapping("/rules")
    public ResponseEntity<ApiResponse<List<AlarmRule>>> listRules() {
        List<AlarmRule> rules = alarmService.listRules();
        return ResponseEntity.ok(ApiResponse.success(rules));
    }

    @PostMapping("/rules")
    public ResponseEntity<ApiResponse<AlarmRule>> createRule(@RequestBody AlarmRule rule) {
        AlarmRule created = alarmService.createRule(rule);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created));
    }

    @PutMapping("/rules/{id}")
    public ResponseEntity<ApiResponse<AlarmRule>> updateRule(
            @PathVariable String id,
            @RequestBody AlarmRule rule) {
        try {
            AlarmRule updated = alarmService.updateRule(id, rule);
            return ResponseEntity.ok(ApiResponse.success(updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRule(@PathVariable String id) {
        try {
            alarmService.deleteRule(id);
            return ResponseEntity.ok(ApiResponse.success());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }
}
