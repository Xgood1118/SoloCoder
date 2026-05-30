package com.bpm.engine.api.dto;

import lombok.Data;

import java.util.Map;

@Data
public class CompleteTaskRequest {

    private String userId;
    private String outcome;
    private String comment;
    private Map<String, Object> variables;
}
