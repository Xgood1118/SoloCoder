package com.bpm.engine.runtime.gateway;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.MultiInstanceConfig;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.common.enums.MultiInstanceCompletion;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.common.util.IdGenerator;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ParallelGatewayHandler implements GatewayHandler {

    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;

    public ParallelGatewayHandler(ExecutionRepository executionRepository,
                            @Lazy RuntimeServiceImpl runtimeService) {
        this.executionRepository = executionRepository;
        this.runtimeService = runtimeService;
    }

    private final Map<String, Integer> arrivingCountMap = new ConcurrentHashMap<>();
    private final Map<String, Integer> totalCountMap = new ConcurrentHashMap<>();

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

        for (int i = 0; i < outgoingFlows.size(); i++) {
            SequenceFlow flow = outgoingFlows.get(i);
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
        int incomingCount = gatewayNode.getIncomingFlows().size();
        int arriving = arrivingCountMap.merge(joinKey, 1, Integer::sum);
        totalCountMap.putIfAbsent(joinKey, incomingCount);

        boolean isMultiInstance = gatewayNode.getMultiInstanceConfig() != null
                && gatewayNode.getMultiInstanceConfig().getType() != com.bpm.engine.common.enums.MultiInstanceType.NONE;

        if (isMultiInstance) {
            MultiInstanceConfig config = gatewayNode.getMultiInstanceConfig();
            if (config.getCompletionCondition() == MultiInstanceCompletion.ANY) {
                if (arriving == 1) {
                    arrivingCountMap.remove(joinKey);
                    totalCountMap.remove(joinKey);
                    proceedToNext(context, gatewayNode);
                }
                return;
            }
        }

        int total = totalCountMap.get(joinKey);
        if (arriving >= total) {
            arrivingCountMap.remove(joinKey);
            totalCountMap.remove(joinKey);
            proceedToNext(context, gatewayNode);
        } else {
            context.getCurrentExecution().setActive(false);
            executionRepository.save(context.getCurrentExecution());
        }
    }

    private void proceedToNext(ExecutionContext context, FlowNode gatewayNode) {
        List<SequenceFlow> outgoingFlows = findOutgoingFlows(context, gatewayNode);
        if (outgoingFlows.isEmpty()) {
            throw new ProcessExecutionException("GATEWAY_NO_OUTGOING",
                    "No outgoing flow found for parallel gateway: " + gatewayNode.getNodeId());
        }
        SequenceFlow flow = outgoingFlows.get(0);
        FlowNode targetNode = findNodeById(context, flow.getTargetRef());
        runtimeService.executeNode(context, targetNode);
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
        ExecutionContext child = new ExecutionContext(
                parent.getProcessInstanceId(),
                parent.getProcessDefinitionId(),
                parent.getProcessDefinition(),
                parent.getProcessInstance(),
                childExecution,
                parent.getVariables(),
                parent.getTenantId()
        );
        return child;
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
