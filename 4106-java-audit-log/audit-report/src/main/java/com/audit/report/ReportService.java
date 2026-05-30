package com.audit.report;

import com.audit.common.enums.ReportPeriod;
import com.audit.common.enums.ReportType;
import com.audit.common.model.ComplianceReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {

    private final ReportGenerator reportGenerator;
    private final ReportArchiveService reportArchiveService;
    private final ReportSigner reportSigner;

    public List<ComplianceReport> listReports(ReportType type, ReportPeriod period, Instant from, Instant to) {
        Map<String, ComplianceReport> reportStore = reportGenerator.getReportStore();
        return reportStore.values().stream()
                .filter(r -> type == null || r.getReportType() == type)
                .filter(r -> period == null || r.getPeriod() == period)
                .filter(r -> from == null || !r.getGeneratedAt().isBefore(from))
                .filter(r -> to == null || !r.getGeneratedAt().isAfter(to))
                .collect(Collectors.toList());
    }

    public ComplianceReport getReport(String id) {
        Map<String, ComplianceReport> reportStore = reportGenerator.getReportStore();
        ComplianceReport report = reportStore.get(id);
        if (report == null) {
            throw new IllegalArgumentException("Report not found: " + id);
        }
        return report;
    }

    public byte[] downloadReport(String id) {
        return reportArchiveService.retrieve(id);
    }

    public void deleteReport(String id) {
        Map<String, ComplianceReport> reportStore = reportGenerator.getReportStore();
        ComplianceReport report = reportStore.get(id);
        if (report == null) {
            throw new IllegalArgumentException("Report not found: " + id);
        }

        try {
            if (report.isArchived() && report.getArchivePath() != null) {
                Path archivePath = Paths.get(report.getArchivePath());
                Files.deleteIfExists(archivePath);
            } else if (report.getContentPath() != null) {
                Path contentPath = Paths.get(report.getContentPath());
                Files.deleteIfExists(contentPath);
            }

            reportStore.remove(id);
            log.info("Deleted report: {}", id);
        } catch (IOException e) {
            log.error("Failed to delete report file: {}", id, e);
            throw new RuntimeException("Failed to delete report file", e);
        }
    }

    public ComplianceReport archiveReport(String id) {
        ComplianceReport report = getReport(id);
        if (report.isArchived()) {
            return report;
        }
        return reportArchiveService.archive(report);
    }

    public boolean verifyReportSignature(String id) {
        ComplianceReport report = getReport(id);
        if (report.getDigitalSignature() == null || report.getSignAlgorithm() == null) {
            return false;
        }

        try {
            byte[] content = reportArchiveService.retrieve(id);
            return reportSigner.verify(content, report.getDigitalSignature());
        } catch (Exception e) {
            log.error("Failed to verify report signature: {}", id, e);
            return false;
        }
    }
}
