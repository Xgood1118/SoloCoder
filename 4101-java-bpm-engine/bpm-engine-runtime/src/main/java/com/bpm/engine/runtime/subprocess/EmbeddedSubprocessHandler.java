package com.bpm.engine.runtime.subprocess;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.common.enums.NodeType;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class EmbeddedSubprocessHandler implements SubprocessHandler {

    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;

    public EmbeddedSubprocessHandler(ExecutionRepository executionRepository,
                                 @Lazy RuntimeServiceImpl runtimeService) {
        this.executionRepository = executionRepository;
        this.runtimeService = runtimeService;
    }

    @Override
    public ExecutionEntity handle(ExecutionContext context, FlowNode subprocessNode) {
        ExecutionEntity childExecution = new ExecutionEntity();
        childExecution.setProcessInstanceId(context.getProcessInstanceId());
        childExecution.setProcessDefinitionId(context.getProcessDefinitionId());
        childExecution.setParentId(context.getCurrentExecution().getId());
        childExecution.setActive(true);
        childExecution.setConcurrent(false);
        childExecution.setScope(true);
        childExecution.setTenantId(context.getTenantId());
        executionRepository.save(childExecution);

        FlowNode startEvent = findStartEvent(context, subprocessNode);
        if (startEvent == null) {
            throw new ProcessExecutionException("SUBPROCESS_NO_START",
                    "No start event found in subprocess: " + subprocessNode.getNodeId());
        }

        childExecution.setActivityId(startEvent.getNodeId());
        childExecution.setActivityName(startEvent.getName());
        childExecution.setActivityType(NodeType.START_EVENT);
        executionRepository.save(childExecution);

        ExecutionContext childContext = new ExecutionContext(
                context.getProcessInstanceId(),
                context.getProcessDefinitionId(),
                context.getProcessDefinition(),
                context.getProcessInstance(),
                childExecution,
                context.getVariables(),
                context.getTenantId()
        );

        runtimeService.executeNode(childContext, startEvent);
        return childExecution;
    }

    private FlowNode findStartEvent(ExecutionContext context, FlowNode subprocessNode) {
        List<String> innerNodeIds = resolveInnerNodes(context, subprocessNode);
        return context.getProcessDefinition().getFlowNodes().stream()
                .filter(n -> innerNodeIds.contains(n.getNodeId()))
                .filter(n -> n.getNodeType() == NodeType.START_EVENT)
                .findFirst()
                .orElse(null);
    }

    private List<String> resolveInnerNodes(ExecutionContext context, FlowNode subprocessNode) {
        return context.getProcessDefinition().getFlowNodes().stream()
                .filter(n -> isInnerNode(context, n, subprocessNode))
                .map(FlowNode::getNodeId)
                .toList();
    }

    private boolean isInnerNode(ExecutionContext context, FlowNode node, FlowNode subprocessNode) {
        for (SequenceFlow flow : context.getProcessDefinition().getSequenceFlows()) {
            if (subprocessNode.getOutgoingFlows().contains(flow.getFlowId())) {
                continue;
            }
            if (flow.getSourceRef().equals(subprocessNode.getNodeId())
                    || flow.getTargetRef().equals(subprocessNode.getNodeId())) {
                continue;
            }
        }
        return true;
    }
}
