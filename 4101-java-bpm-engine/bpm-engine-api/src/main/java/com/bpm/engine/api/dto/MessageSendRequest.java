package com.bpm.engine.api.dto;

import lombok.Data;

import java.util.Map;

@Data
public class MessageSendRequest {

    private String messageId;
    private String targetProcessInstanceId;
    private String targetExecutionId;
    private Map<String, Object> payload;
}
