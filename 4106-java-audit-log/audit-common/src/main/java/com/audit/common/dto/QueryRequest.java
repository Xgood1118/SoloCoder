package com.audit.common.dto;

import com.audit.common.enums.LogLevel;
import com.audit.common.enums.LogType;
import com.audit.common.enums.StorageType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueryRequest {

    private Instant startTime;
    private Instant endTime;

    private String operatorId;
    private String operatorName;
    private String operatorIp;

    private String action;
    private String resourceType;
    private String resourceId;

    private LogLevel logLevel;
    private LogType logType;

    private String keyword;
    private String regexPattern;

    private String traceId;

    @Builder.Default
    @Min(1)
    private int page = 1;

    @Builder.Default
    @Min(1)
    @Max(1000)
    private int size = 20;

    private StorageType storageType;
    private String sortBy;
    private String sortOrder;
}
