package com.bpm.engine.runtime.gateway;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.common.util.IdGenerator;
import com.bpm.engine.expression.service.ExpressionService;
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
public class InclusiveGatewayHandler implements GatewayHandler {

    private final ExpressionService expressionService;
    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;

    public InclusiveGatewayHandler(ExpressionService expressionService,
                              ExecutionRepository executionRepository,
                              @Lazy RuntimeServiceImpl runtimeService) {
        this.expressionService = expressionService;
        this.executionRepository = executionRepository;
        this.runtimeService = runtimeService;
    }

    private final Map<String, List<String>> activatedBranchesMap = new ConcurrentHashMap<>();

    @Override
    public void handle(ExecutionContext context, FlowNode gatewayNode) {
        List<String> incomingFlows = gatewayNode.getIncomingFlows();
        List<String> outgoingFlows = gatewayNode.getOutgoingFlows();

        if (outgoingFlows.size() > 1) {
            handleFork(context, gatewayNode);
        } else if (incomingFlows.size() > 1) {
            handleJoin(context, gatewayNode);
        } else {
            proceedToNext(context, gatewayNode);
        }
    }

    private void handleFork(ExecutionContext context, FlowNode gatewayNode) {
        List<SequenceFlow> outgoingFlows = findOutgoingFlows(context, gatewayNode);
        List<SequenceFlow> activatedFlows = new ArrayList<>();
        SequenceFlow defaultFlow = null;

        for (SequenceFlow flow : outgoingFlows) {
            if (flow.isDefault()) {
                defaultFlow = flow;
                continue;
            }
            if (flow.getConditionExpression() != null && evaluateCondition(flow, context.getVariables())) {
                activatedFlows.add(flow);
            }
        }

        if (activatedFlows.isEmpty() && defaultFlow != null) {
            activatedFlows.add(defaultFlow);
        }

        if (activatedFlows.isEmpty()) {
            throw new ProcessExecutionException("GATEWAY_NO_MATCH",
                    "No matching outgoing flow found for inclusive gateway: " + gatewayNode.getNodeId());
        }

        String forkKey = context.getProcessInstanceId() + ":" + gatewayNode.getNodeId();
        List<String> activatedTargetRefs = activatedFlows.stream()
                .map(SequenceFlow::getTargetRef)
                .toList();
        activatedBranchesMap.put(forkKey, activatedTargetRefs);

        for (SequenceFlow flow : activatedFlows) {
            ExecutionEntity concurrentExecution = createConcurrentExecution(context, flow.getTargetRef());
            ExecutionContext childContext = buildChildContext(context, concurrentExecution);
            FlowNode targetNode = findNodeById(context, flow.getTargetRef());
            runtimeService.executeNode(childContext, targetNode);
        }

        context.getCurrentExecution().setActive(false);
        executionRepository.save(context.getCurrentExecution());
    }

    private void handleJoin(ExecutionContext context, FlowNode gatewayNode) {
        String joinKey = context.getProcessInstanceId() + ":" + gatewayNode.getNodeId();

        List<ExecutionEntity> activeExecutions = executionRepository
                .findByProcessInstanceIdAndIsActive(context.getProcessInstanceId(), true);

        long activeIncomingCount = activeExecutions.stream()
                .filter(e -> {
                    FlowNode node = findNodeById(context, e.getActivityId());
                    return node != null && hasPathToGateway(context, node, gatewayNode);
                })
                .count();

        String forkKey = findForkKey(context, gatewayNode);
        List<String> activatedRefs = activatedBranchesMap.getOrDefault(forkKey, List.of());
        int expectedCount = activatedRefs.size();

        if (expectedCount == 0) {
            expectedCount = gatewayNode.getIncomingFlows().size();
        }

        long arrivedCount = expectedCount - activeIncomingCount + 1;

        if (arrivedCount >= expectedCount) {
            activatedBranchesMap.remove(forkKey);
            proceedToNext(context, gatewayNode);
        } else {
            context.getCurrentExecution().setActive(false);
            executionRepository.save(context.getCurrentExecution());
        }
    }

    private boolean hasPathToGateway(ExecutionContext context, FlowNode fromNode, FlowNode gatewayNode) {
        for (String flowId : fromNode.getOutgoingFlows()) {
            var optFlow = context.getProcessDefinition().getSequenceFlows().stream()
                    .filter(f -> f.getFlowId().equals(flowId))
                    .findFirst();
            if (optFlow.isPresent()) {
                if (optFlow.get().getTargetRef().equals(gatewayNode.getNodeId())) {
                    return true;
                }
                FlowNode next = findNodeById(context, optFlow.get().getTargetRef());
                if (next != null && hasPathToGateway(context, next, gatewayNode)) {
                    return true;
                }
            }
        }
        return false;
    }

    private String findForkKey(ExecutionContext context, FlowNode joinGateway) {
        for (Map.Entry<String, List<String>> entry : activatedBranchesMap.entrySet()) {
            if (entry.getKey().startsWith(context.getProcessInstanceId())) {
                return entry.getKey();
            }
        }
        return context.getProcessInstanceId() + ":" + joinGateway.getNodeId();
    }

    private void proceedToNext(ExecutionContext context, FlowNode gatewayNode) {
        List<SequenceFlow> outgoingFlows = findOutgoingFlows(context, gatewayNode);
        if (outgoingFlows.isEmpty()) {
            throw new ProcessExecutionException("GATEWAY_NO_OUTGOING",
                    "No outgoing flow found for inclusive gateway: " + gatewayNode.getNodeId());
        }
        SequenceFlow flow = outgoingFlows.get(0);
        FlowNode targetNode = findNodeById(context, flow.getTargetRef());
        runtimeService.executeNode(context, targetNode);
    }

    private boolean evaluateCondition(SequenceFlow flow, Map<String, Object> variables) {
        ExpressionType type = flow.getConditionType() != null ? flow.getConditionType() : ExpressionType.UEL;
        return expressionService.evaluateCondition(flow.getConditionExpression(), type, variables);
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
                .orElse(null);
    }
}
