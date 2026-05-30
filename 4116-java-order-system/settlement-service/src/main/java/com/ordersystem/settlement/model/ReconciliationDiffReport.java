package com.ordersystem.settlement.model;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("reconciliation_diff_report")
public class ReconciliationDiffReport {
    private Long id;
    private LocalDate reportDate;
    private Integer totalRecords;
    private Integer matchedRecords;
    private Integer mismatchRecords;
    private Integer systemMissingRecords;
    private Integer channelMissingRecords;
    private Integer autoFixed;
    private Integer manualPending;
    private ReportStatus status;
    private LocalDateTime createdAt;
}
