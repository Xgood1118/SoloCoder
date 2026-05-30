package com.bpm.engine.runtime.boundary;

import com.bpm.engine.bpmn.model.BoundaryEventConfig;
import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ErrorBoundaryHandler implements BoundaryEventHandler {

    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;

    public ErrorBoundaryHandler(ExecutionRepository executionRepository,
                           @Lazy RuntimeServiceImpl runtimeService) {
        this.executionRepository = executionRepository;
        this.runtimeService = runtimeService;
    }

    @Override
    public void handle(ExecutionContext context, FlowNode boundaryNode, ExecutionEntity execution) {
        BoundaryEventConfig config = boundaryNode.getBoundaryEventConfig();
        if (config == null) {
            throw new ProcessExecutionException("BOUNDARY_CONFIG_MISSING",
                    "Boundary event config missing for: " + boundaryNode.getNodeId());
        }
    }

    public boolean handleError(ExecutionContext context, FlowNode boundaryNode, String errorCode) {
        BoundaryEventConfig config = boundaryNode.getBoundaryEventConfig();
        if (config == null) {
            return false;
        }

        if (config.getErrorCode() != null && !config.getErrorCode().isEmpty()
                && !config.getErrorCode().equals(errorCode)) {
            return false;
        }

        String attachedToRef = config.getAttachedToRef();

        if (config.isCancelActivity()) {
            List<ExecutionEntity> childExecutions = executionRepository
                    .findByProcessInstanceIdAndIsActive(context.getProcessInstanceId(), true);
            for (ExecutionEntity child : childExecutions) {
                if (child.getParentId() != null) {
                    child.setActive(false);
                    executionRepository.save(child);
                }
            }
        }

        SequenceFlow outgoingFlow = getOutgoingFlow(context, boundaryNode);
        if (outgoingFlow != null) {
            FlowNode targetNode = findNodeById(context, outgoingFlow.getTargetRef());
            runtimeService.executeNode(context, targetNode);
        }

        return true;
    }

    private SequenceFlow getOutgoingFlow(ExecutionContext context, FlowNode boundaryNode) {
        List<SequenceFlow> flows = context.getProcessDefinition().getSequenceFlows().stream()
                .filter(f -> boundaryNode.getOutgoingFlows().contains(f.getFlowId()))
                .toList();
        return flows.isEmpty() ? null : flows.get(0);
    }

    private FlowNode findNodeById(ExecutionContext context, String nodeId) {
        return context.getProcessDefinition().getFlowNodes().stream()
                .filter(n -> n.getNodeId().equals(nodeId))
                .findFirst()
                .orElseThrow(() -> new ProcessExecutionException("NODE_NOT_FOUND",
                        "Flow node not found: " + nodeId));
    }
}
