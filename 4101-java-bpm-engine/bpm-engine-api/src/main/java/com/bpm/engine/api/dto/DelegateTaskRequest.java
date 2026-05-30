package com.bpm.engine.api.dto;

import lombok.Data;

@Data
public class DelegateTaskRequest {

    private String taskId;
    private String delegateUserId;
}
