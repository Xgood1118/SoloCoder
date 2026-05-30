package com.bpm.engine.bpmn.model;

import lombok.Data;

@Data
public class ServiceTaskConfig {

    private String implementation;
    private String implementationValue;
    private String resultVariable;
}
