package com.bpm.engine.runtime.boundary;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.service.ExecutionContext;

public interface BoundaryEventHandler {

    void handle(ExecutionContext context, FlowNode boundaryNode, ExecutionEntity execution);
}
