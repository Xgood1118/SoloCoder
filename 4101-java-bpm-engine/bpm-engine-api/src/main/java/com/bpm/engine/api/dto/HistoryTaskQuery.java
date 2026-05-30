package com.bpm.engine.api.dto;

import com.bpm.engine.common.enums.TaskStatus;
import lombok.Data;

@Data
public class HistoryTaskQuery {

    private String assignee;
    private TaskStatus status;
    private String processInstanceId;
    private String tenantId;
    private Integer pageNum = 1;
    private Integer pageSize = 10;
}
