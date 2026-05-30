package com.bpm.engine.api.dto;

import lombok.Data;

@Data
public class HistoryActivityQuery {

    private String processInstanceId;
    private String activityId;
    private String assignee;
    private Integer pageNum = 1;
    private Integer pageSize = 10;
}
