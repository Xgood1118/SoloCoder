package com.featureflag.controller;

import com.featureflag.entity.AuditLog;
import com.featureflag.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping("/flag/{flagKey}")
    public ResponseEntity<Page<AuditLog>> getAuditLogsByFlag(
            @PathVariable String flagKey,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AuditLog> logs = auditLogService.getAuditLogsByFlag(flagKey, PageRequest.of(page, size));
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/flag/{flagKey}/range")
    public ResponseEntity<List<AuditLog>> getAuditLogsByFlagAndTime(
            @PathVariable String flagKey,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        List<AuditLog> logs = auditLogService.getAuditLogsByFlagAndTime(flagKey, start, end);
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/operator/{operator}")
    public ResponseEntity<List<AuditLog>> getAuditLogsByOperator(@PathVariable String operator) {
        List<AuditLog> logs = auditLogService.getAuditLogsByOperator(operator);
        return ResponseEntity.ok(logs);
    }
}
