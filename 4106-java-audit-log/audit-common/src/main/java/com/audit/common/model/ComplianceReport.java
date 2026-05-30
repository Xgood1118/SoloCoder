package com.audit.common.model;

import com.audit.common.enums.ReportPeriod;
import com.audit.common.enums.ReportType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComplianceReport {

    private String id;
    private ReportType reportType;
    private ReportPeriod period;
    private Instant periodStart;
    private Instant periodEnd;

    private String generatedBy;
    private Instant generatedAt;

    private String contentPath;
    private String digitalSignature;
    private String signAlgorithm;

    private boolean archived;
    private String archivePath;
    private long fileSizeBytes;
}
