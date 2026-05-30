package com.bpm.engine.bpmn.model;

import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
public class SubProcessConfig {

    private boolean embedded;
    private String calledElement;
    private Map<String, String> inputMapping = new HashMap<>();
    private Map<String, String> outputMapping = new HashMap<>();
    private Map<String, String> dataObjects = new HashMap<>();
}
