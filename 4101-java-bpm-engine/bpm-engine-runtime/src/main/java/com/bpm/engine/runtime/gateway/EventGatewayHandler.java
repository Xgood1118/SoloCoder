package com.bpm.engine.runtime.gateway;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.common.util.IdGenerator;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class EventGatewayHandler implements GatewayHandler {

    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;

    public EventGatewayHandler(ExecutionRepository executionRepository,
                          @Lazy RuntimeServiceImpl runtimeService) {
        this.executionRepository = executionRepository;
        this.runtimeService = runtimeService;
    }

    private final Map<String, List<String>> pendingEventExecutions = new ConcurrentHashMap<>();

    @Override
    public void handle(ExecutionContext context, FlowNode gatewayNode) {
        List<SequenceFlow> outgoingFlows = findOutgoingFlows(context, gatewayNode);

        List<ExecutionEntity> eventExecutions = new ArrayList<>();
        List<String> executionIds = new ArrayList<>();

        for (SequenceFlow flow : outgoingFlows) {
            ExecutionEntity eventExecution = createConcurrentExecution(context, flow.getTargetRef());
            eventExecutions.add(eventExecution);
            executionIds.add(eventExecution.getId());

            ExecutionContext childContext = buildChildContext(context, eventExecution);
            FlowNode targetNode = findNodeById(context, flow.getTargetRef());
            runtimeService.executeNode(childContext, targetNode);
        }

        String gatewayKey = context.getProcessInstanceId() + ":" + gatewayNode.getNodeId();
        pendingEventExecutions.put(gatewayKey, executionIds);

        context.getCurrentExecution().setActive(false);
        executionRepository.save(context.getCurrentExecution());
    }

    public void onEventFired(String processInstanceId, String gatewayNodeId, String winningExecutionId) {
        String gatewayKey = processInstanceId + ":" + gatewayNodeId;
        List<String> executionIds = pendingEventExecutions.remove(gatewayKey);

        if (executionIds != null) {
            for (String execId : executionIds) {
                if (!execId.equals(winningExecutionId)) {
                    executionRepository.findById(execId).ifPresent(exec -> {
                        exec.setActive(false);
                        executionRepository.save(exec);
                    });
                }
            }
        }
    }

    private ExecutionEntity createConcurrentExecution(ExecutionContext context, String targetActivityId) {
        ExecutionEntity execution = new ExecutionEntity();
        execution.setProcessInstanceId(context.getProcessInstanceId());
        execution.setProcessDefinitionId(context.getProcessDefinitionId());
        execution.setParentId(context.getCurrentExecution().getId());
        execution.setActivityId(targetActivityId);
        execution.setActive(true);
        execution.setConcurrent(true);
        execution.setScope(false);
        execution.setTenantId(context.getTenantId());
        return executionRepository.save(execution);
    }

    private ExecutionContext buildChildContext(ExecutionContext parent, ExecutionEntity childExecution) {
        return new ExecutionContext(
                parent.getProcessInstanceId(),
                parent.getProcessDefinitionId(),
                parent.getProcessDefinition(),
                parent.getProcessInstance(),
                childExecution,
                parent.getVariables(),
                parent.getTenantId()
        );
    }

    private List<SequenceFlow> findOutgoingFlows(ExecutionContext context, FlowNode gatewayNode) {
        return context.getProcessDefinition().getSequenceFlows().stream()
                .filter(f -> gatewayNode.getOutgoingFlows().contains(f.getFlowId()))
                .toList();
    }

    private FlowNode findNodeById(ExecutionContext context, String nodeId) {
        return context.getProcessDefinition().getFlowNodes().stream()
                .filter(n -> n.getNodeId().equals(nodeId))
                .findFirst()
                .orElseThrow(() -> new ProcessExecutionException("NODE_NOT_FOUND",
                        "Flow node not found: " + nodeId));
    }
}
