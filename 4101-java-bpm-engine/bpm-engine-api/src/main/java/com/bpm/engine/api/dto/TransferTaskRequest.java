package com.bpm.engine.api.dto;

import lombok.Data;

@Data
public class TransferTaskRequest {

    private String taskId;
    private String targetUserId;
}
