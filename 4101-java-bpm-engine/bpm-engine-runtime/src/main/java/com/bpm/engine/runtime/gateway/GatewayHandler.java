package com.bpm.engine.runtime.gateway;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.runtime.service.ExecutionContext;

public interface GatewayHandler {

    void handle(ExecutionContext context, FlowNode gatewayNode);
}
