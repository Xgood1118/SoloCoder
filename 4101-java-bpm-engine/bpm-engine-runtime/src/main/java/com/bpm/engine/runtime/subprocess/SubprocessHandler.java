package com.bpm.engine.runtime.subprocess;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.service.ExecutionContext;

public interface SubprocessHandler {

    ExecutionEntity handle(ExecutionContext context, FlowNode subprocessNode);
}
