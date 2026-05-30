package com.bpm.engine.bpmn.model;

import lombok.Data;

@Data
public class SignalDefinition {

    private String signalId;
    private String name;
    private String scope;
}
