package com.audit.report;

import com.audit.common.enums.ReportPeriod;
import com.audit.common.enums.ReportType;
import com.audit.common.model.ComplianceReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReportScheduler {

    private static final String OPERATOR_ID = "system-scheduler";

    private final ReportGenerator reportGenerator;
    private final ReportSigner reportSigner;
    private final ReportArchiveService reportArchiveService;

    private final Set<ReportType> enabledReportTypes = EnumSet.allOf(ReportType.class);

    @Scheduled(cron = "0 0 1 * * ?", zone = "UTC")
    public void generateDailyReports() {
        log.info("Starting daily report generation at {}", Instant.now());
        Instant end = Instant.now().truncatedTo(ChronoUnit.DAYS);
        Instant start = end.minus(1, ChronoUnit.DAYS);

        for (ReportType type : enabledReportTypes) {
            try {
                ComplianceReport report = reportGenerator.generate(
                        type, ReportPeriod.DAILY, start, end, OPERATOR_ID);
                reportSigner.signReport(report);
                log.info("Generated daily report: {} of type: {}", report.getId(), type);
            } catch (Exception e) {
                log.error("Failed to generate daily report for type: {}", type, e);
            }
        }

        reportArchiveService.cleanupExpired();
        log.info("Daily report generation completed at {}", Instant.now());
    }

    @Scheduled(cron = "0 0 2 * * MON", zone = "UTC")
    public void generateWeeklyReports() {
        log.info("Starting weekly report generation at {}", Instant.now());
        Instant end = Instant.now().truncatedTo(ChronoUnit.DAYS);
        Instant start = end.minus(7, ChronoUnit.DAYS);

        for (ReportType type : enabledReportTypes) {
            try {
                ComplianceReport report = reportGenerator.generate(
                        type, ReportPeriod.WEEKLY, start, end, OPERATOR_ID);
                reportSigner.signReport(report);
                log.info("Generated weekly report: {} of type: {}", report.getId(), type);
            } catch (Exception e) {
                log.error("Failed to generate weekly report for type: {}", type, e);
            }
        }

        log.info("Weekly report generation completed at {}", Instant.now());
    }

    @Scheduled(cron = "0 0 3 1 * ?", zone = "UTC")
    public void generateMonthlyReports() {
        log.info("Starting monthly report generation at {}", Instant.now());
        Instant end = Instant.now().truncatedTo(ChronoUnit.DAYS);
        Instant start = end.minus(30, ChronoUnit.DAYS);

        for (ReportType type : enabledReportTypes) {
            try {
                ComplianceReport report = reportGenerator.generate(
                        type, ReportPeriod.MONTHLY, start, end, OPERATOR_ID);
                reportSigner.signReport(report);
                log.info("Generated monthly report: {} of type: {}", report.getId(), type);
            } catch (Exception e) {
                log.error("Failed to generate monthly report for type: {}", type, e);
            }
        }

        log.info("Monthly report generation completed at {}", Instant.now());
    }

    public Set<ReportType> getEnabledReportTypes() {
        return enabledReportTypes;
    }

    public void setReportTypeEnabled(ReportType type, boolean enabled) {
        if (enabled) {
            enabledReportTypes.add(type);
        } else {
            enabledReportTypes.remove(type);
        }
    }
}
