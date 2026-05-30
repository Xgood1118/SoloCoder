package com.featureflag.controller;

import com.featureflag.entity.ScheduleConfig;
import com.featureflag.service.ScheduleConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/feature-flags/{flagId}/schedules")
@RequiredArgsConstructor
public class ScheduleConfigController {

    private final ScheduleConfigService scheduleConfigService;

    @GetMapping
    public ResponseEntity<List<ScheduleConfig>> getSchedules(@PathVariable Long flagId) {
        List<ScheduleConfig> schedules = scheduleConfigService.getSchedulesByFlag(flagId);
        return ResponseEntity.ok(schedules);
    }

    @GetMapping("/active")
    public ResponseEntity<List<ScheduleConfig>> getActiveSchedules(@PathVariable Long flagId) {
        List<ScheduleConfig> schedules = scheduleConfigService.getActiveSchedules(flagId);
        return ResponseEntity.ok(schedules);
    }

    @PostMapping
    public ResponseEntity<ScheduleConfig> createSchedule(
            @PathVariable Long flagId,
            @RequestBody ScheduleConfig config,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        ScheduleConfig created = scheduleConfigService.createSchedule(flagId, config, operator);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{scheduleId}")
    public ResponseEntity<ScheduleConfig> updateSchedule(
            @PathVariable Long scheduleId,
            @RequestBody ScheduleConfig config) {
        ScheduleConfig updated = scheduleConfigService.updateSchedule(scheduleId, config);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> deleteSchedule(@PathVariable Long scheduleId) {
        scheduleConfigService.deleteSchedule(scheduleId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{scheduleId}/toggle")
    public ResponseEntity<Void> toggleSchedule(
            @PathVariable Long scheduleId,
            @RequestParam boolean enabled) {
        scheduleConfigService.toggleSchedule(scheduleId, enabled);
        return ResponseEntity.ok().build();
    }
}
