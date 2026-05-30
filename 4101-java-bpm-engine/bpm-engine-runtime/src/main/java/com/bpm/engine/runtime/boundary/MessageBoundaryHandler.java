package com.bpm.engine.runtime.boundary;

import com.bpm.engine.bpmn.model.BoundaryEventConfig;
import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import com.bpm.engine.runtime.signal.MessageService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class MessageBoundaryHandler implements BoundaryEventHandler {

    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;
    private final MessageService messageService;

    public MessageBoundaryHandler(ExecutionRepository executionRepository,
                             @Lazy RuntimeServiceImpl runtimeService,
                             MessageService messageService) {
        this.executionRepository = executionRepository;
        this.runtimeService = runtimeService;
        this.messageService = messageService;
    }

    @Override
    public void handle(ExecutionContext context, FlowNode boundaryNode, ExecutionEntity execution) {
        BoundaryEventConfig config = boundaryNode.getBoundaryEventConfig();
        if (config == null || config.getMessageRef() == null) {
            throw new ProcessExecutionException("MESSAGE_CONFIG_MISSING",
                    "Message ref missing for boundary event: " + boundaryNode.getNodeId());
        }

        messageService.sendMessage(
                boundaryNode.getNodeId(),
                context.getProcessInstanceId(),
                execution.getId(),
                null
        );
    }

    public void onMessageReceived(ExecutionContext context, FlowNode boundaryNode) {
        BoundaryEventConfig config = boundaryNode.getBoundaryEventConfig();
        String attachedToRef = config.getAttachedToRef();

        if (config.isCancelActivity()) {
            List<ExecutionEntity> attachedExecutions = executionRepository.findByActivityId(attachedToRef);
            for (ExecutionEntity attached : attachedExecutions) {
                if (attached.getProcessInstanceId().equals(context.getProcessInstanceId())) {
                    attached.setActive(false);
                    executionRepository.save(attached);
                }
            }
        }

        SequenceFlow outgoingFlow = getOutgoingFlow(context, boundaryNode);
        if (outgoingFlow != null) {
            FlowNode targetNode = findNodeById(context, outgoingFlow.getTargetRef());
            runtimeService.executeNode(context, targetNode);
        }
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
