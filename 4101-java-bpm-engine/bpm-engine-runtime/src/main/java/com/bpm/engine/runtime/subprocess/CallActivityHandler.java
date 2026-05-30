package com.bpm.engine.runtime.subprocess;

import com.bpm.engine.bpmn.model.BpmnProcess;
import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SubProcessConfig;
import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.expression.service.ExpressionService;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;
import com.bpm.engine.runtime.entity.VariableEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.repository.ProcessInstanceRepository;
import com.bpm.engine.runtime.repository.VariableRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import com.bpm.engine.bpmn.service.ProcessDefinitionService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Component
public class CallActivityHandler implements SubprocessHandler {

    private final ProcessDefinitionService processDefinitionService;
    private final ProcessInstanceRepository processInstanceRepository;
    private final ExecutionRepository executionRepository;
    private final VariableRepository variableRepository;
    private final ExpressionService expressionService;
    private final RuntimeServiceImpl runtimeService;

    public CallActivityHandler(ProcessDefinitionService processDefinitionService,
                           ProcessInstanceRepository processInstanceRepository,
                           ExecutionRepository executionRepository,
                           VariableRepository variableRepository,
                           ExpressionService expressionService,
                           @Lazy RuntimeServiceImpl runtimeService) {
        this.processDefinitionService = processDefinitionService;
        this.processInstanceRepository = processInstanceRepository;
        this.executionRepository = executionRepository;
        this.variableRepository = variableRepository;
        this.expressionService = expressionService;
        this.runtimeService = runtimeService;
    }

    @Override
    public ExecutionEntity handle(ExecutionContext context, FlowNode subprocessNode) {
        SubProcessConfig config = subprocessNode.getSubProcessConfig();
        if (config == null || config.getCalledElement() == null) {
            throw new ProcessExecutionException("CALL_ACTIVITY_CONFIG_MISSING",
                    "Called element not specified for call activity: " + subprocessNode.getNodeId());
        }

        String calledElement = config.getCalledElement();
        BpmnProcess subProcessDefinition = processDefinitionService.getLatestProcessDefinition(calledElement);
        if (subProcessDefinition == null) {
            throw new ProcessExecutionException("CALL_ACTIVITY_DEFINITION_NOT_FOUND",
                    "Process definition not found for called element: " + calledElement);
        }

        Map<String, Object> inputVariables = applyInputMapping(config.getInputMapping(), context.getVariables());

        ProcessInstanceEntity subInstance = new ProcessInstanceEntity();
        subInstance.setProcessDefinitionId(subProcessDefinition.getProcessKey());
        subInstance.setProcessKey(subProcessDefinition.getProcessKey());
        subInstance.setProcessName(subProcessDefinition.getName());
        subInstance.setVersion(subProcessDefinition.getVersion());
        subInstance.setStatus(ProcessStatus.RUNNING);
        subInstance.setStartUserId(context.getProcessInstance().getStartUserId());
        subInstance.setStartTime(LocalDateTime.now());
        subInstance.setSuspended(false);
        subInstance.setTenantId(context.getTenantId());
        processInstanceRepository.save(subInstance);

        saveVariables(subInstance.getId(), inputVariables, context.getTenantId());

        return null;
    }

    public void applyOutputMapping(String subProcessInstanceId, String parentProcessInstanceId,
                                   Map<String, String> outputMapping, Map<String, Object> subVariables) {
        for (Map.Entry<String, String> entry : outputMapping.entrySet()) {
            String sourceExpression = entry.getKey();
            String targetVariable = entry.getValue();

            Object value = expressionService.evaluate(sourceExpression, ExpressionType.UEL, subVariables);
            VariableEntity var = new VariableEntity();
            var.setProcessInstanceId(parentProcessInstanceId);
            var.setVariableName(targetVariable);
            var.setVariableType(inferVariableType(value));
            if (value != null) {
                var.setTextValue(value.toString());
                var.setTextLength(value.toString().length());
            }
            variableRepository.save(var);
        }
    }

    private Map<String, Object> applyInputMapping(Map<String, String> inputMapping, Map<String, Object> parentVariables) {
        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<String, String> entry : inputMapping.entrySet()) {
            String targetName = entry.getKey();
            String sourceExpression = entry.getValue();
            Object value = expressionService.evaluate(sourceExpression, ExpressionType.UEL, parentVariables);
            result.put(targetName, value);
        }
        return result;
    }

    private void saveVariables(String processInstanceId, Map<String, Object> variables, String tenantId) {
        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            VariableEntity var = new VariableEntity();
            var.setProcessInstanceId(processInstanceId);
            var.setVariableName(entry.getKey());
            var.setVariableType(inferVariableType(entry.getValue()));
            if (entry.getValue() != null) {
                var.setTextValue(entry.getValue().toString());
                var.setTextLength(entry.getValue().toString().length());
            }
            var.setTenantId(tenantId);
            variableRepository.save(var);
        }
    }

    private com.bpm.engine.common.enums.VariableType inferVariableType(Object value) {
        if (value == null) return com.bpm.engine.common.enums.VariableType.STRING;
        if (value instanceof String) return com.bpm.engine.common.enums.VariableType.STRING;
        if (value instanceof Integer) return com.bpm.engine.common.enums.VariableType.INTEGER;
        if (value instanceof Long) return com.bpm.engine.common.enums.VariableType.LONG;
        if (value instanceof Double) return com.bpm.engine.common.enums.VariableType.DOUBLE;
        if (value instanceof Boolean) return com.bpm.engine.common.enums.VariableType.BOOLEAN;
        if (value instanceof LocalDateTime) return com.bpm.engine.common.enums.VariableType.DATE;
        return com.bpm.engine.common.enums.VariableType.OBJECT;
    }
}
