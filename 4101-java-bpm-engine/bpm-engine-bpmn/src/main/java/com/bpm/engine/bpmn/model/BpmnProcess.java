package com.bpm.engine.bpmn.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
public class BpmnProcess {

    private String processKey;
    private String name;
    private int version;
    private String category;
    private boolean isExecutable;
    private List<FlowNode> flowNodes = new ArrayList<>();
    private List<SequenceFlow> sequenceFlows = new ArrayList<>();
    private List<SignalDefinition> signals = new ArrayList<>();
    private List<MessageDefinition> messages = new ArrayList<>();
    private Map<String, String> documentation = new HashMap<>();
}
