package com.bpm.engine.runtime.subprocess;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.common.util.IdGenerator;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;
import com.bpm.engine.runtime.entity.VariableEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.repository.ProcessInstanceRepository;
import com.bpm.engine.runtime.repository.VariableRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

@Component
public class IndependentSubprocessHandler implements SubprocessHandler {

    private final ProcessInstanceRepository processInstanceRepository;
    private final ExecutionRepository executionRepository;
    private final VariableRepository variableRepository;
    private final RuntimeServiceImpl runtimeService;

    public IndependentSubprocessHandler(ProcessInstanceRepository processInstanceRepository,
                                     ExecutionRepository executionRepository,
                                     VariableRepository variableRepository,
                                     @Lazy RuntimeServiceImpl runtimeService) {
        this.processInstanceRepository = processInstanceRepository;
        this.executionRepository = executionRepository;
        this.variableRepository = variableRepository;
        this.runtimeService = runtimeService;
    }

    @Override
    public ExecutionEntity handle(ExecutionContext context, FlowNode subprocessNode) {
        ProcessInstanceEntity subInstance = new ProcessInstanceEntity();
        subInstance.setProcessDefinitionId(context.getProcessDefinitionId());
        subInstance.setProcessKey(context.getProcessDefinition().getProcessKey());
        subInstance.setProcessName(context.getProcessDefinition().getName());
        subInstance.setVersion(context.getProcessDefinition().getVersion());
        subInstance.setStatus(ProcessStatus.RUNNING);
        subInstance.setStartUserId(context.getProcessInstance().getStartUserId());
        subInstance.setStartTime(LocalDateTime.now());
        subInstance.setSuspended(false);
        subInstance.setTenantId(context.getTenantId());
        processInstanceRepository.save(subInstance);

        copyVariables(context.getProcessInstanceId(), subInstance.getId(), context.getVariables());

        ExecutionEntity subExecution = new ExecutionEntity();
        subExecution.setProcessInstanceId(subInstance.getId());
        subExecution.setProcessDefinitionId(context.getProcessDefinitionId());
        subExecution.setParentId(null);
        subExecution.setActive(true);
        subExecution.setConcurrent(false);
        subExecution.setScope(true);
        subExecution.setTenantId(context.getTenantId());
        executionRepository.save(subExecution);

        return subExecution;
    }

    public void copyOutputVariables(String subProcessInstanceId, String parentProcessInstanceId,
                                    Map<String, String> outputMapping) {
        for (VariableEntity var : variableRepository.findByProcessInstanceId(subProcessInstanceId)) {
            if (outputMapping.containsKey(var.getVariableName())) {
                String targetName = outputMapping.get(var.getVariableName());
                VariableEntity parentVar = new VariableEntity();
                parentVar.setProcessInstanceId(parentProcessInstanceId);
                parentVar.setVariableName(targetName);
                parentVar.setVariableType(var.getVariableType());
                parentVar.setTextValue(var.getTextValue());
                parentVar.setLongValue(var.getLongValue());
                parentVar.setDoubleValue(var.getDoubleValue());
                parentVar.setJsonValue(var.getJsonValue());
                parentVar.setDateValue(var.getDateValue());
                parentVar.setTextLength(var.getTextLength());
                parentVar.setScope(var.getScope());
                parentVar.setTenantId(var.getTenantId());
                variableRepository.save(parentVar);
            }
        }
    }

    private void copyVariables(String sourceProcessInstanceId, String targetProcessInstanceId,
                              Map<String, Object> variables) {
        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            VariableEntity var = new VariableEntity();
            var.setProcessInstanceId(targetProcessInstanceId);
            var.setVariableName(entry.getKey());
            var.setVariableType(inferVariableType(entry.getValue()));
            var.setTextValue(entry.getValue() != null ? entry.getValue().toString() : null);
            var.setTextLength(entry.getValue() != null ? entry.getValue().toString().length() : 0);
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
