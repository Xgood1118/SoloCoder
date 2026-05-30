package com.bpm.engine.api.dto;

import lombok.Data;

@Data
public class SignUserRequest {

    private String taskId;
    private String userId;
    private String operationUserId;
}
