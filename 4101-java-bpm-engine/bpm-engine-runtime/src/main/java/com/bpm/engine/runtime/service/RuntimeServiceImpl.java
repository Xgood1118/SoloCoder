package com.bpm.engine.runtime.service;

import com.bpm.engine.bpmn.model.BpmnProcess;
import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.bpmn.service.ProcessDefinitionService;
import com.bpm.engine.common.enums.GatewayType;
import com.bpm.engine.common.enums.NodeType;
import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.common.enums.VariableType;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.common.util.JsonUtils;
import com.bpm.engine.expression.service.ExpressionService;
import com.bpm.engine.runtime.boundary.BoundaryEventHandlerFactory;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;
import com.bpm.engine.runtime.entity.VariableEntity;
import com.bpm.engine.runtime.gateway.GatewayHandlerFactory;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.repository.ProcessInstanceRepository;
import com.bpm.engine.runtime.repository.VariableRepository;
import com.bpm.engine.runtime.subprocess.SubprocessHandlerFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RuntimeServiceImpl implements RuntimeService {

    private final ProcessInstanceRepository processInstanceRepository;
    private final ExecutionRepository executionRepository;
    private final VariableRepository variableRepository;
    private final ProcessDefinitionService processDefinitionService;
    private final ExpressionService expressionService;
    private final GatewayHandlerFactory gatewayHandlerFactory;
    private final BoundaryEventHandlerFactory boundaryEventHandlerFactory;
    private final SubprocessHandlerFactory subprocessHandlerFactory;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public ProcessInstanceEntity startProcessByKey(String processKey, String businessKey,
                                                    String startUserId, Map<String, Object> variables,
                                                    String tenantId) {
        BpmnProcess processDefinition = processDefinitionService.getLatestProcessDefinition(processKey);
        if (processDefinition == null) {
            throw new ProcessExecutionException("DEFINITION_NOT_FOUND",
                    "Process definition not found for key: " + processKey);
        }

        String definitionId = resolveDefinitionId(processKey);
        return doStartProcess(definitionId, processDefinition, businessKey, startUserId, variables, tenantId);
    }

    @Override
    @Transactional
    public ProcessInstanceEntity startProcessById(String definitionId, String businessKey,
                                                   String startUserId, Map<String, Object> variables,
                                                   String tenantId) {
        BpmnProcess processDefinition = processDefinitionService.getProcessDefinition(definitionId);
        if (processDefinition == null) {
            throw new ProcessExecutionException("DEFINITION_NOT_FOUND",
                    "Process definition not found for id: " + definitionId);
        }

        return doStartProcess(definitionId, processDefinition, businessKey, startUserId, variables, tenantId);
    }

    private ProcessInstanceEntity doStartProcess(String definitionId, BpmnProcess processDefinition,
                                                 String businessKey, String startUserId,
                                                 Map<String, Object> variables, String tenantId) {
        ProcessInstanceEntity instance = new ProcessInstanceEntity();
        instance.setProcessDefinitionId(definitionId);
        instance.setProcessKey(processDefinition.getProcessKey());
        instance.setProcessName(processDefinition.getName());
        instance.setVersion(processDefinition.getVersion());
        instance.setStatus(ProcessStatus.RUNNING);
        instance.setBusinessKey(businessKey);
        instance.setStartUserId(startUserId);
        instance.setStartTime(LocalDateTime.now());
        instance.setSuspended(false);
        instance.setTenantId(tenantId);
        processInstanceRepository.save(instance);

        if (variables != null) {
            for (Map.Entry<String, Object> entry : variables.entrySet()) {
                saveVariable(instance.getId(), null, null, entry.getKey(), entry.getValue(), "process", tenantId);
            }
        }

        FlowNode startEvent = findStartEvent(processDefinition);
        if (startEvent == null) {
            throw new ProcessExecutionException("START_EVENT_NOT_FOUND",
                    "No start event found in process: " + processDefinition.getProcessKey());
        }

        instance.setStartActivityId(startEvent.getNodeId());
        processInstanceRepository.save(instance);

        ExecutionEntity rootExecution = new ExecutionEntity();
        rootExecution.setProcessInstanceId(instance.getId());
        rootExecution.setProcessDefinitionId(definitionId);
        rootExecution.setActivityId(startEvent.getNodeId());
        rootExecution.setActivityName(startEvent.getName());
        rootExecution.setActivityType(NodeType.START_EVENT);
        rootExecution.setActive(true);
        rootExecution.setConcurrent(false);
        rootExecution.setScope(false);
        rootExecution.setTenantId(tenantId);
        executionRepository.save(rootExecution);

        ExecutionContext context = new ExecutionContext(
                instance.getId(),
                definitionId,
                processDefinition,
                instance,
                rootExecution,
                variables != null ? variables : new HashMap<>(),
                tenantId
        );

        executeNode(context, startEvent);
        return instance;
    }

    @Transactional
    public void executeNode(ExecutionContext context, FlowNode node) {
        if (node == null) {
            return;
        }

        context.getCurrentExecution().setActivityId(node.getNodeId());
        context.getCurrentExecution().setActivityName(node.getName());
        context.getCurrentExecution().setActivityType(node.getNodeType());
        executionRepository.save(context.getCurrentExecution());

        switch (node.getNodeType()) {
            case START_EVENT -> handleStartEvent(context, node);
            case END_EVENT -> handleEndEvent(context, node);
            case USER_TASK -> handleUserTask(context, node);
            case SERVICE_TASK -> handleServiceTask(context, node);
            case EXCLUSIVE_GATEWAY -> gatewayHandlerFactory.getHandler(GatewayType.EXCLUSIVE).handle(context, node);
            case PARALLEL_GATEWAY -> gatewayHandlerFactory.getHandler(GatewayType.PARALLEL).handle(context, node);
            case INCLUSIVE_GATEWAY -> gatewayHandlerFactory.getHandler(GatewayType.INCLUSIVE).handle(context, node);
            case EVENT_GATEWAY -> gatewayHandlerFactory.getHandler(GatewayType.EVENT).handle(context, node);
            case SUBPROCESS -> subprocessHandlerFactory.getHandler(node).handle(context, node);
            case CALL_ACTIVITY -> subprocessHandlerFactory.getHandler(node).handle(context, node);
            case BOUNDARY_EVENT -> handleBoundaryEvent(context, node);
            case INTERMEDIATE_CATCH_EVENT -> handleIntermediateCatchEvent(context, node);
            case INTERMEDIATE_THROW_EVENT -> handleIntermediateThrowEvent(context, node);
            case SCRIPT_TASK -> handleScriptTask(context, node);
            default -> throw new ProcessExecutionException("UNSUPPORTED_NODE_TYPE",
                    "Unsupported node type: " + node.getNodeType());
        }
    }

    private void handleStartEvent(ExecutionContext context, FlowNode node) {
        SequenceFlow outgoing = findFirstOutgoingFlow(context, node);
        if (outgoing != null) {
            FlowNode nextNode = findNodeById(context, outgoing.getTargetRef());
            executeNode(context, nextNode);
        }
    }

    private void handleEndEvent(ExecutionContext context, FlowNode node) {
        context.getCurrentExecution().setActive(false);
        executionRepository.save(context.getCurrentExecution());

        context.getProcessInstance().setEndActivityId(node.getNodeId());
        context.getProcessInstance().setEndTime(LocalDateTime.now());
        if (context.getProcessInstance().getStartTime() != null) {
            context.getProcessInstance().setDurationInMillis(
                    java.time.Duration.between(context.getProcessInstance().getStartTime(), LocalDateTime.now()).toMillis()
            );
        }

        List<ExecutionEntity> activeExecutions = executionRepository
                .findByProcessInstanceIdAndIsActive(context.getProcessInstanceId(), true);

        if (activeExecutions.isEmpty()) {
            context.getProcessInstance().setStatus(ProcessStatus.COMPLETED);
            processInstanceRepository.save(context.getProcessInstance());
        } else {
            processInstanceRepository.save(context.getProcessInstance());
        }
    }

    private void handleUserTask(ExecutionContext context, FlowNode node) {
        context.getCurrentExecution().setActive(true);
        executionRepository.save(context.getCurrentExecution());
    }

    private void handleServiceTask(ExecutionContext context, FlowNode node) {
        if (node.getServiceTaskConfig() != null) {
            var config = node.getServiceTaskConfig();
            if (config.getImplementation() != null && config.getImplementationValue() != null) {
                Object result = expressionService.evaluate(
                        config.getImplementationValue(),
                        com.bpm.engine.common.enums.ExpressionType.UEL,
                        context.getVariables()
                );
                if (config.getResultVariable() != null && result != null) {
                    context.setVariable(config.getResultVariable(), result);
                    saveVariable(context.getProcessInstanceId(), context.getCurrentExecution().getId(),
                            null, config.getResultVariable(), result, "process", context.getTenantId());
                }
            }
        }

        SequenceFlow outgoing = findFirstOutgoingFlow(context, node);
        if (outgoing != null) {
            FlowNode nextNode = findNodeById(context, outgoing.getTargetRef());
            executeNode(context, nextNode);
        }
    }

    private void handleScriptTask(ExecutionContext context, FlowNode node) {
        SequenceFlow outgoing = findFirstOutgoingFlow(context, node);
        if (outgoing != null) {
            FlowNode nextNode = findNodeById(context, outgoing.getTargetRef());
            executeNode(context, nextNode);
        }
    }

    private void handleBoundaryEvent(ExecutionContext context, FlowNode node) {
        if (node.getBoundaryEventConfig() != null) {
            boundaryEventHandlerFactory.getHandler(node.getBoundaryEventConfig().getEventType())
                    .handle(context, node, context.getCurrentExecution());
        }
    }

    private void handleIntermediateCatchEvent(ExecutionContext context, FlowNode node) {
        context.getCurrentExecution().setActive(true);
        executionRepository.save(context.getCurrentExecution());
    }

    private void handleIntermediateThrowEvent(ExecutionContext context, FlowNode node) {
        SequenceFlow outgoing = findFirstOutgoingFlow(context, node);
        if (outgoing != null) {
            FlowNode nextNode = findNodeById(context, outgoing.getTargetRef());
            executeNode(context, nextNode);
        }
    }

    @Override
    @Transactional
    public void signalExecution(String executionId, Map<String, Object> variables) {
        ExecutionEntity execution = executionRepository.findById(executionId)
                .orElseThrow(() -> new ProcessExecutionException("EXECUTION_NOT_FOUND",
                        "Execution not found: " + executionId));

        if (!execution.isActive()) {
            throw new ProcessExecutionException("EXECUTION_NOT_ACTIVE",
                    "Execution is not active: " + executionId);
        }

        if (variables != null) {
            for (Map.Entry<String, Object> entry : variables.entrySet()) {
                saveVariable(execution.getProcessInstanceId(), executionId, null,
                        entry.getKey(), entry.getValue(), "process", execution.getTenantId());
            }
        }

        FlowNode currentNode = findNodeById(execution.getActivityId(), execution.getProcessInstanceId());
        if (currentNode != null) {
            SequenceFlow outgoing = findFirstOutgoingFlow(execution.getProcessInstanceId(), currentNode);
            if (outgoing != null) {
                FlowNode nextNode = findNodeById(execution.getProcessInstanceId(), outgoing.getTargetRef());
                if (nextNode != null) {
                    ProcessInstanceEntity instance = processInstanceRepository.findById(execution.getProcessInstanceId())
                            .orElse(null);
                    BpmnProcess processDef = processDefinitionService.getProcessDefinition(
                            execution.getProcessDefinitionId());

                    ExecutionContext context = new ExecutionContext(
                            execution.getProcessInstanceId(),
                            execution.getProcessDefinitionId(),
                            processDef,
                            instance,
                            execution,
                            loadVariables(execution.getProcessInstanceId()),
                            execution.getTenantId()
                    );

                    executeNode(context, nextNode);
                }
            }
        }
    }

    @Override
    @Transactional
    public void completeExecution(String executionId, Map<String, Object> variables) {
        signalExecution(executionId, variables);
    }

    @Override
    public ExecutionEntity getExecution(String executionId) {
        return executionRepository.findById(executionId).orElse(null);
    }

    @Override
    public ProcessInstanceEntity getProcessInstance(String processInstanceId) {
        return processInstanceRepository.findById(processInstanceId).orElse(null);
    }

    @Override
    public List<ExecutionEntity> getActiveExecutions(String processInstanceId) {
        return executionRepository.findByProcessInstanceIdAndIsActive(processInstanceId, true);
    }

    @Override
    public Map<String, Object> getProcessVariables(String processInstanceId) {
        return loadVariables(processInstanceId);
    }

    @Override
    @Transactional
    public void setProcessVariable(String processInstanceId, String variableName, Object value) {
        Optional<VariableEntity> existing = variableRepository
                .findByProcessInstanceIdAndVariableName(processInstanceId, variableName);
        if (existing.isPresent()) {
            VariableEntity var = existing.get();
            updateVariableValue(var, value);
            variableRepository.save(var);
        } else {
            ProcessInstanceEntity instance = processInstanceRepository.findById(processInstanceId)
                    .orElseThrow(() -> new ProcessExecutionException("PROCESS_NOT_FOUND",
                            "Process instance not found: " + processInstanceId));
            saveVariable(processInstanceId, null, null, variableName, value, "process", instance.getTenantId());
        }
    }

    @Override
    public Object getProcessVariable(String processInstanceId, String variableName) {
        Optional<VariableEntity> var = variableRepository
                .findByProcessInstanceIdAndVariableName(processInstanceId, variableName);
        return var.map(this::extractVariableValue).orElse(null);
    }

    private FlowNode findStartEvent(BpmnProcess process) {
        return process.getFlowNodes().stream()
                .filter(n -> n.getNodeType() == NodeType.START_EVENT)
                .findFirst()
                .orElse(null);
    }

    private SequenceFlow findFirstOutgoingFlow(ExecutionContext context, FlowNode node) {
        return context.getProcessDefinition().getSequenceFlows().stream()
                .filter(f -> node.getOutgoingFlows().contains(f.getFlowId()))
                .findFirst()
                .orElse(null);
    }

    private SequenceFlow findFirstOutgoingFlow(String processInstanceId, FlowNode node) {
        return null;
    }

    private FlowNode findNodeById(ExecutionContext context, String nodeId) {
        return context.getProcessDefinition().getFlowNodes().stream()
                .filter(n -> n.getNodeId().equals(nodeId))
                .findFirst()
                .orElse(null);
    }

    private FlowNode findNodeById(String nodeId, String processInstanceId) {
        return null;
    }

    private String resolveDefinitionId(String processKey) {
        return processKey;
    }

    private Map<String, Object> loadVariables(String processInstanceId) {
        Map<String, Object> result = new HashMap<>();
        List<VariableEntity> variables = variableRepository.findByProcessInstanceId(processInstanceId);
        for (VariableEntity var : variables) {
            result.put(var.getVariableName(), extractVariableValue(var));
        }
        return result;
    }

    private void saveVariable(String processInstanceId, String executionId, String taskId,
                              String variableName, Object value, String scope, String tenantId) {
        VariableEntity var = new VariableEntity();
        var.setProcessInstanceId(processInstanceId);
        var.setExecutionId(executionId);
        var.setTaskId(taskId);
        var.setVariableName(variableName);
        var.setVariableType(inferVariableType(value));
        var.setScope(scope);
        var.setTenantId(tenantId);
        setVariableValue(var, value);
        variableRepository.save(var);
    }

    private void setVariableValue(VariableEntity var, Object value) {
        if (value == null) {
            var.setTextValue(null);
            return;
        }
        switch (inferVariableType(value)) {
            case STRING -> {
                var.setTextValue((String) value);
                var.setTextLength(((String) value).length());
            }
            case INTEGER, LONG -> var.setLongValue(((Number) value).longValue());
            case DOUBLE -> var.setDoubleValue(((Number) value).doubleValue());
            case BOOLEAN -> var.setTextValue(value.toString());
            case DATE -> var.setDateValue((LocalDateTime) value);
            case JSON -> {
                var.setJsonValue(JsonUtils.toJson(value));
                var.setTextLength(var.getJsonValue().length());
            }
            default -> {
                var.setTextValue(value.toString());
                var.setTextLength(value.toString().length());
            }
        }
    }

    private void updateVariableValue(VariableEntity var, Object value) {
        var.setTextValue(null);
        var.setLongValue(null);
        var.setDoubleValue(null);
        var.setJsonValue(null);
        var.setDateValue(null);
        var.setTextLength(0);
        var.setVariableType(inferVariableType(value));
        setVariableValue(var, value);
    }

    private Object extractVariableValue(VariableEntity var) {
        if (var.getTextValue() != null && var.getVariableType() == VariableType.STRING) {
            return var.getTextValue();
        }
        if (var.getLongValue() != null && (var.getVariableType() == VariableType.INTEGER
                || var.getVariableType() == VariableType.LONG)) {
            return var.getLongValue();
        }
        if (var.getDoubleValue() != null && var.getVariableType() == VariableType.DOUBLE) {
            return var.getDoubleValue();
        }
        if (var.getDateValue() != null && var.getVariableType() == VariableType.DATE) {
            return var.getDateValue();
        }
        if (var.getJsonValue() != null && var.getVariableType() == VariableType.JSON) {
            return var.getJsonValue();
        }
        if (var.getTextValue() != null) {
            return var.getTextValue();
        }
        return null;
    }

    private VariableType inferVariableType(Object value) {
        if (value == null) return VariableType.STRING;
        if (value instanceof String) return VariableType.STRING;
        if (value instanceof Integer) return VariableType.INTEGER;
        if (value instanceof Long) return VariableType.LONG;
        if (value instanceof Double || value instanceof Float) return VariableType.DOUBLE;
        if (value instanceof Boolean) return VariableType.BOOLEAN;
        if (value instanceof LocalDateTime) return VariableType.DATE;
        return VariableType.OBJECT;
    }
}
