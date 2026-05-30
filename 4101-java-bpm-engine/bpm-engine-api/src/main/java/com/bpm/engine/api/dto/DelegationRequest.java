package com.bpm.engine.api.dto;

import com.bpm.engine.common.enums.DelegationType;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DelegationRequest {

    private String delegatorId;
    private String delegateUserId;
    private DelegationType type;
    private String processDefinitionId;
    private LocalDateTime effectiveTime;
    private LocalDateTime expiryTime;
    private String tenantId;
}
