package com.featureflag.controller;

import com.featureflag.dto.FeatureFlagDTO;
import com.featureflag.dto.FlagEvaluationRequest;
import com.featureflag.dto.FlagEvaluationResponse;
import com.featureflag.entity.FeatureFlag;
import com.featureflag.enums.Environment;
import com.featureflag.service.FeatureFlagEvaluationService;
import com.featureflag.service.FeatureFlagManagementService;
import com.featureflag.service.FlagChangeEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/feature-flags")
@RequiredArgsConstructor
public class FeatureFlagController {

    private final FeatureFlagManagementService managementService;
    private final FeatureFlagEvaluationService evaluationService;
    private final FlagChangeEventService eventService;

    @PostMapping("/evaluate")
    public ResponseEntity<FlagEvaluationResponse> evaluate(@Valid @RequestBody FlagEvaluationRequest request) {
        FlagEvaluationResponse response = evaluationService.evaluate(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<FeatureFlag>> getFlags(
            @RequestParam String application,
            @RequestParam(required = false) String environment) {
        Environment env = environment != null ? Environment.valueOf(environment.toUpperCase()) : null;
        List<FeatureFlag> flags = managementService.getFlagsByApplication(application, env);
        return ResponseEntity.ok(flags);
    }

    @GetMapping("/{id}")
    public ResponseEntity<FeatureFlag> getFlag(@PathVariable Long id) {
        FeatureFlag flag = managementService.getFlag(id);
        if (flag == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(flag);
    }

    @GetMapping("/key/{flagKey}")
    public ResponseEntity<FeatureFlag> getFlagByKey(
            @PathVariable String flagKey,
            @RequestParam String application,
            @RequestParam(defaultValue = "PRODUCTION") String environment) {
        Environment env = Environment.valueOf(environment.toUpperCase());
        FeatureFlag flag = managementService.getFlagByKey(flagKey, application, env);
        if (flag == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(flag);
    }

    @PostMapping
    public ResponseEntity<FeatureFlag> createFlag(
            @Valid @RequestBody FeatureFlagDTO dto,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        FeatureFlag flag = managementService.createFlag(dto, operator);
        return ResponseEntity.ok(flag);
    }

    @PutMapping("/{id}")
    public ResponseEntity<FeatureFlag> updateFlag(
            @PathVariable Long id,
            @Valid @RequestBody FeatureFlagDTO dto,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        FeatureFlag flag = managementService.updateFlag(id, dto, operator);
        return ResponseEntity.ok(flag);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFlag(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        managementService.deleteFlag(id, operator);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/toggle")
    public ResponseEntity<FeatureFlag> toggleFlag(
            @PathVariable Long id,
            @RequestParam boolean enabled,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        FeatureFlag flag = managementService.toggleFlag(id, enabled, operator);
        return ResponseEntity.ok(flag);
    }

    @GetMapping("/group/{groupName}")
    public ResponseEntity<List<FeatureFlag>> getFlagsByGroup(@PathVariable String groupName) {
        List<FeatureFlag> flags = managementService.getFlagsByGroup(groupName);
        return ResponseEntity.ok(flags);
    }

    @GetMapping("/events/subscribe")
    public SseEmitter subscribeEvents(@RequestParam String application) {
        return eventService.subscribeSse(application);
    }

    @GetMapping("/events/poll")
    public ResponseEntity<Object> pollEvents(
            @RequestParam String application,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since) {
        Object events = eventService.longPoll(application, since);
        return ResponseEntity.ok(events);
    }
}
