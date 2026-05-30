package com.audit.api;

import com.audit.common.dto.ApiResponse;
import com.audit.common.dto.PageResult;
import com.audit.common.dto.QueryRequest;
import com.audit.common.exception.QueryInjectionException;
import com.audit.common.model.AuditLogEntry;
import com.audit.logger.AuditLoggerService;
import com.audit.storage.StorageRouter;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/audit/logs")
@RequiredArgsConstructor
@Slf4j
public class AuditLogController {

    private final AuditLoggerService auditLoggerService;
    private final StorageRouter storageRouter;
    private final CorrelationService correlationService;
    private final ExportService exportService;

    private static final Pattern INJECTION_PATTERN = Pattern.compile("([';--]|(/\\*.*\\*/)|(<script.*>.*</script>))", Pattern.CASE_INSENSITIVE);

    @PostMapping
    public ResponseEntity<ApiResponse<AuditLogEntry>> logEntry(@RequestBody AuditLogEntry entry) {
        AuditLogEntry saved = auditLoggerService.log(entry);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(saved));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuditLogEntry>> getById(@PathVariable String id) {
        validateInput(id);
        AuditLogEntry entry = storageRouter.getById(id);
        if (entry == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, "Log entry not found: " + id));
        }
        return ResponseEntity.ok(ApiResponse.success(entry));
    }

    @PostMapping("/query")
    public ResponseEntity<ApiResponse<PageResult<AuditLogEntry>>> query(@Valid @RequestBody QueryRequest request) {
        validateQueryRequest(request);
        PageResult<AuditLogEntry> result = storageRouter.query(request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/trace/{traceId}")
    public ResponseEntity<ApiResponse<List<AuditLogEntry>>> getByTraceId(@PathVariable String traceId) {
        validateInput(traceId);
        List<AuditLogEntry> logs = correlationService.getLogsByTraceId(traceId);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/export/csv")
    public void exportCsv(
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(required = false) String operatorId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String resourceId,
            HttpServletResponse response) throws IOException {

        QueryRequest request = QueryRequest.builder()
                .startTime(startTime)
                .endTime(endTime)
                .operatorId(operatorId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .page(1)
                .size(10000)
                .build();

        validateQueryRequest(request);
        List<AuditLogEntry> records = storageRouter.query(request).getRecords();

        String fileName = URLEncoder.encode("audit_logs_" + Instant.now().toEpochMilli() + ".csv", StandardCharsets.UTF_8);
        response.setContentType("text/csv;charset=UTF-8");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName);

        exportService.writeCsvToStream(records, response.getOutputStream());
    }

    @GetMapping("/export/excel")
    public void exportExcel(
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(required = false) String operatorId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String resourceId,
            HttpServletResponse response) throws IOException {

        QueryRequest request = QueryRequest.builder()
                .startTime(startTime)
                .endTime(endTime)
                .operatorId(operatorId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .page(1)
                .size(10000)
                .build();

        validateQueryRequest(request);
        List<AuditLogEntry> records = storageRouter.query(request).getRecords();

        String fileName = URLEncoder.encode("audit_logs_" + Instant.now().toEpochMilli() + ".xlsx", StandardCharsets.UTF_8);
        response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName);

        exportService.writeExcelToStream(records, response.getOutputStream());
    }

    private void validateInput(String input) {
        if (input != null && INJECTION_PATTERN.matcher(input).find()) {
            throw new QueryInjectionException("Potential injection detected in input: " + input);
        }
    }

    private void validateQueryRequest(QueryRequest request) {
        validateInput(request.getOperatorId());
        validateInput(request.getOperatorName());
        validateInput(request.getOperatorIp());
        validateInput(request.getAction());
        validateInput(request.getResourceType());
        validateInput(request.getResourceId());
        validateInput(request.getKeyword());
        validateInput(request.getRegexPattern());
        validateInput(request.getTraceId());
        validateInput(request.getSortBy());
    }
}
