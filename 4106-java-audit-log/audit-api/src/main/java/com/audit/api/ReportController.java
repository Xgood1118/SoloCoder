package com.audit.api;

import com.audit.common.dto.ApiResponse;
import com.audit.common.enums.ReportPeriod;
import com.audit.common.enums.ReportType;
import com.audit.common.model.ComplianceReport;
import com.audit.report.ReportService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audit/reports")
@RequiredArgsConstructor
@Slf4j
public class ReportController {

    private final ReportService reportService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ComplianceReport>>> listReports(
            @RequestParam(required = false) ReportType type,
            @RequestParam(required = false) ReportPeriod period,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime) {

        List<ComplianceReport> reports = reportService.listReports(type, period, startTime, endTime);
        return ResponseEntity.ok(ApiResponse.success(reports));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ComplianceReport>> getReport(@PathVariable String id) {
        try {
            ComplianceReport report = reportService.getReport(id);
            return ResponseEntity.ok(ApiResponse.success(report));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }

    @GetMapping("/{id}/download")
    public void downloadReport(@PathVariable String id, HttpServletResponse response) throws IOException {
        try {
            ComplianceReport report = reportService.getReport(id);
            InputStream inputStream = reportService.downloadReport(id);

            String fileName = URLEncoder.encode("report_" + id + ".pdf", StandardCharsets.UTF_8);
            response.setContentType(MediaType.APPLICATION_PDF_VALUE);
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName);
            response.setContentLengthLong(report.getFileSizeBytes());

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                response.getOutputStream().write(buffer, 0, bytesRead);
            }
            response.getOutputStream().flush();
        } catch (IllegalArgumentException e) {
            response.setStatus(HttpStatus.NOT_FOUND.value());
            response.getWriter().write(e.getMessage());
        }
    }

    @PostMapping("/generate")
    public ResponseEntity<ApiResponse<ComplianceReport>> generateReport(@RequestBody Map<String, Object> body) {
        ReportType type = ReportType.valueOf(body.get("type").toString());
        ReportPeriod period = ReportPeriod.valueOf(body.get("period").toString());
        Instant start = Instant.parse(body.get("start").toString());
        Instant end = Instant.parse(body.get("end").toString());
        String generatedBy = body.get("generatedBy") != null ? body.get("generatedBy").toString() : "system";

        ComplianceReport report = reportService.generateReport(type, period, start, end, generatedBy);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(report));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<ApiResponse<ComplianceReport>> archiveReport(@PathVariable String id) {
        try {
            ComplianceReport report = reportService.archiveReport(id);
            return ResponseEntity.ok(ApiResponse.success(report));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteReport(@PathVariable String id) {
        try {
            reportService.deleteReport(id);
            return ResponseEntity.ok(ApiResponse.success());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        }
    }
}
