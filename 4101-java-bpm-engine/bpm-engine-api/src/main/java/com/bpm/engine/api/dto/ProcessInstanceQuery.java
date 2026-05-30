package com.bpm.engine.api.dto;

import com.bpm.engine.common.enums.ProcessStatus;
import lombok.Data;

@Data
public class ProcessInstanceQuery {

    private String processKey;
    private ProcessStatus status;
    private String startUserId;
    private String tenantId;
    private Integer pageNum = 1;
    private Integer pageSize = 10;
}
