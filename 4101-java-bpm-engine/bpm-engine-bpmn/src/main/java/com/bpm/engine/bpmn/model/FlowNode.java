package com.bpm.engine.bpmn.model;

import com.bpm.engine.common.enums.NodeType;
import lombok.Data;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
public class FlowNode {

    private String nodeId;
    private String name;
    private NodeType nodeType;
    private List<String> incomingFlows = new ArrayList<>();
    private List<String> outgoingFlows = new ArrayList<>();
    private MultiInstanceConfig multiInstanceConfig;
    private Map<String, String> properties = new HashMap<>();
    private String documentation;
    private GatewayConfig gatewayConfig;
    private BoundaryEventConfig boundaryEventConfig;
    private SubProcessConfig subProcessConfig;
    private UserTaskConfig userTaskConfig;
    private ServiceTaskConfig serviceTaskConfig;
}
