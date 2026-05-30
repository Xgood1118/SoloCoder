package com.bpm.engine.api.dto;

import lombok.Data;

@Data
public class DeployRequest {

    private String xml;
    private String tenantId;
}
