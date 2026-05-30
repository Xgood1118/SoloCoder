package com.bpm.engine.bpmn.validator;

import com.bpm.engine.bpmn.model.BpmnProcess;
import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.common.enums.NodeType;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class DefaultProcessDefinitionValidator implements ProcessDefinitionValidator {

    @Override
    public ValidationResult validate(BpmnProcess process) {
        ValidationResult result = new ValidationResult();

        if (process == null) {
            result.addError("Process definition is null");
            return result;
        }

        if (process.getProcessKey() == null || process.getProcessKey().isEmpty()) {
            result.addError("Process key is required");
        }

        validateStartEvents(process, result);
        validateEndEvents(process, result);
        validateSequenceFlows(process, result);
        validateGateways(process, result);
        validateBoundaryEvents(process, result);
        validateCallActivities(process, result);
        validateParallelGatewayPairing(process, result);
        validateOrphanedNodes(process, result);

        return result;
    }

    private void validateStartEvents(BpmnProcess process, ValidationResult result) {
        long startEventCount = process.getFlowNodes().stream()
                .filter(n -> n.getNodeType() == NodeType.START_EVENT)
                .count();

        if (startEventCount == 0) {
            result.addError("Process must have at least one start event");
        } else if (startEventCount > 1) {
            result.addWarning("Process has multiple start events");
        }
    }

    private void validateEndEvents(BpmnProcess process, ValidationResult result) {
        long endEventCount = process.getFlowNodes().stream()
                .filter(n -> n.getNodeType() == NodeType.END_EVENT)
                .count();

        if (endEventCount == 0) {
            result.addError("Process must have at least one end event");
        }
    }

    private void validateSequenceFlows(BpmnProcess process, ValidationResult result) {
        Set<String> nodeIds = process.getFlowNodes().stream()
                .map(FlowNode::getNodeId)
                .collect(Collectors.toSet());

        for (SequenceFlow flow : process.getSequenceFlows()) {
            if (flow.getSourceRef() == null || flow.getSourceRef().isEmpty()) {
                result.addError("Sequence flow '" + flow.getFlowId() + "' has no source ref");
            } else if (!nodeIds.contains(flow.getSourceRef())) {
                result.addError("Sequence flow '" + flow.getFlowId() + "' references non-existent source node '" + flow.getSourceRef() + "'");
            }

            if (flow.getTargetRef() == null || flow.getTargetRef().isEmpty()) {
                result.addError("Sequence flow '" + flow.getFlowId() + "' has no target ref");
            } else if (!nodeIds.contains(flow.getTargetRef())) {
                result.addError("Sequence flow '" + flow.getFlowId() + "' references non-existent target node '" + flow.getTargetRef() + "'");
            }
        }
    }

    private void validateGateways(BpmnProcess process, ValidationResult result) {
        for (FlowNode node : process.getFlowNodes()) {
            if (isGatewayType(node.getNodeType())) {
                if (isConvergingGateway(node, process)) {
                    continue;
                }
                if (node.getOutgoingFlows().size() < 2) {
                    result.addWarning("Gateway '" + node.getNodeId() + "' should have at least 2 outgoing flows for branching");
                }
            }
        }
    }

    private boolean isGatewayType(NodeType nodeType) {
        return nodeType == NodeType.EXCLUSIVE_GATEWAY
                || nodeType == NodeType.PARALLEL_GATEWAY
                || nodeType == NodeType.INCLUSIVE_GATEWAY
                || nodeType == NodeType.EVENT_GATEWAY;
    }

    private boolean isConvergingGateway(FlowNode node, BpmnProcess process) {
        return node.getIncomingFlows().size() > 1 && node.getOutgoingFlows().size() <= 1;
    }

    private void validateBoundaryEvents(BpmnProcess process, ValidationResult result) {
        Set<String> activityNodeIds = process.getFlowNodes().stream()
                .filter(n -> isActivityType(n.getNodeType()))
                .map(FlowNode::getNodeId)
                .collect(Collectors.toSet());

        for (FlowNode node : process.getFlowNodes()) {
            if (node.getNodeType() == NodeType.BOUNDARY_EVENT && node.getBoundaryEventConfig() != null) {
                String attachedToRef = node.getBoundaryEventConfig().getAttachedToRef();
                if (attachedToRef == null || attachedToRef.isEmpty()) {
                    result.addError("Boundary event '" + node.getNodeId() + "' must specify attachedToRef");
                } else if (!activityNodeIds.contains(attachedToRef)) {
                    result.addError("Boundary event '" + node.getNodeId() + "' is attached to non-activity node '" + attachedToRef + "'");
                }
            }
        }
    }

    private boolean isActivityType(NodeType nodeType) {
        return nodeType == NodeType.USER_TASK
                || nodeType == NodeType.SERVICE_TASK
                || nodeType == NodeType.SCRIPT_TASK
                || nodeType == NodeType.SUBPROCESS
                || nodeType == NodeType.CALL_ACTIVITY;
    }

    private void validateCallActivities(BpmnProcess process, ValidationResult result) {
        for (FlowNode node : process.getFlowNodes()) {
            if (node.getNodeType() == NodeType.CALL_ACTIVITY) {
                if (node.getSubProcessConfig() == null || node.getSubProcessConfig().getCalledElement() == null
                        || node.getSubProcessConfig().getCalledElement().isEmpty()) {
                    result.addError("Call activity '" + node.getNodeId() + "' must reference a valid process key via calledElement");
                }
            }
        }
    }

    private void validateParallelGatewayPairing(BpmnProcess process, ValidationResult result) {
        List<FlowNode> parallelGateways = process.getFlowNodes().stream()
                .filter(n -> n.getNodeType() == NodeType.PARALLEL_GATEWAY)
                .collect(Collectors.toList());

        long forks = parallelGateways.stream()
                .filter(n -> n.getOutgoingFlows().size() > 1)
                .count();

        long joins = parallelGateways.stream()
                .filter(n -> n.getIncomingFlows().size() > 1)
                .count();

        if (forks != joins) {
            result.addWarning("Parallel gateway fork/join count mismatch: " + forks + " forks, " + joins + " joins");
        }
    }

    private void validateOrphanedNodes(BpmnProcess process, ValidationResult result) {
        Set<String> reachableNodeIds = new HashSet<>();

        List<FlowNode> startEvents = process.getFlowNodes().stream()
                .filter(n -> n.getNodeType() == NodeType.START_EVENT)
                .collect(Collectors.toList());

        Map<String, FlowNode> nodeMap = process.getFlowNodes().stream()
                .collect(Collectors.toMap(FlowNode::getNodeId, n -> n));

        Map<String, List<String>> adjacency = new HashMap<>();
        for (SequenceFlow flow : process.getSequenceFlows()) {
            adjacency.computeIfAbsent(flow.getSourceRef(), k -> new ArrayList<>()).add(flow.getTargetRef());
        }

        Deque<String> queue = new ArrayDeque<>();
        for (FlowNode start : startEvents) {
            reachableNodeIds.add(start.getNodeId());
            queue.add(start.getNodeId());
        }

        while (!queue.isEmpty()) {
            String current = queue.poll();
            List<String> targets = adjacency.get(current);
            if (targets != null) {
                for (String target : targets) {
                    if (reachableNodeIds.add(target)) {
                        queue.add(target);
                    }
                }
            }
        }

        for (FlowNode node : process.getFlowNodes()) {
            if (!reachableNodeIds.contains(node.getNodeId())) {
                result.addWarning("Node '" + node.getNodeId() + "' is unreachable from any start event");
            }
        }
    }
}
