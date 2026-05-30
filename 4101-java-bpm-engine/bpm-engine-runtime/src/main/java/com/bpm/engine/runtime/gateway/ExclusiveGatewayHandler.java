package com.bpm.engine.runtime.gateway;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.expression.service.ExpressionService;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class ExclusiveGatewayHandler implements GatewayHandler {

    private final ExpressionService expressionService;
    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;

    public ExclusiveGatewayHandler(ExpressionService expressionService,
                                ExecutionRepository executionRepository,
                                @Lazy RuntimeServiceImpl runtimeService) {
        this.expressionService = expressionService;
        this.executionRepository = executionRepository;
        this.runtimeService = runtimeService;
    }

    @Override
    public void handle(ExecutionContext context, FlowNode gatewayNode) {
        List<SequenceFlow> outgoingFlows = findOutgoingFlows(context, gatewayNode);
        SequenceFlow selectedFlow = null;

        for (SequenceFlow flow : outgoingFlows) {
            if (flow.isDefault()) {
                continue;
            }
            if (flow.getConditionExpression() != null && evaluateCondition(flow, context.getVariables())) {
                selectedFlow = flow;
                break;
            }
        }

        if (selectedFlow == null) {
            selectedFlow = outgoingFlows.stream()
                    .filter(SequenceFlow::isDefault)
                    .findFirst()
                    .orElse(null);
        }

        if (selectedFlow == null) {
            throw new ProcessExecutionException("GATEWAY_NO_MATCH",
                    "No matching outgoing flow found for exclusive gateway: " + gatewayNode.getNodeId());
        }

        FlowNode targetNode = findNodeById(context, selectedFlow.getTargetRef());
        runtimeService.executeNode(context, targetNode);
    }

    private boolean evaluateCondition(SequenceFlow flow, Map<String, Object> variables) {
        ExpressionType type = flow.getConditionType() != null ? flow.getConditionType() : ExpressionType.UEL;
        return expressionService.evaluateCondition(flow.getConditionExpression(), type, variables);
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
