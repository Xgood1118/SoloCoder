package com.bpm.engine.api.dto;

import lombok.Data;

import java.util.Map;

@Data
public class MessageCorrelateRequest {

    private String messageName;
    private String businessKey;
    private Map<String, Object> payload;
}
