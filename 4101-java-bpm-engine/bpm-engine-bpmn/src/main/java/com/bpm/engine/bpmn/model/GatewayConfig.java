package com.bpm.engine.bpmn.model;

import com.bpm.engine.common.enums.GatewayType;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class GatewayConfig {

    private GatewayType gatewayType;
    private List<SequenceFlow> outgoingFlows = new ArrayList<>();
}
