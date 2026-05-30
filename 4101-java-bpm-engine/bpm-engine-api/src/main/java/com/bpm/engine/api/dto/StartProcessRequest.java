package com.bpm.engine.api.dto;

import lombok.Data;

import java.util.Map;

@Data
public class StartProcessRequest {

    private String processKey;
    private String definitionId;
    private String businessKey;
    private String startUserId;
    private String tenantId;
    private Map<String, Object> variables;
}
