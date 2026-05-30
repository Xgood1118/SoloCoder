package com.bpm.engine.runtime.service;

import com.bpm.engine.bpmn.model.BpmnProcess;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;
import lombok.Getter;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
public class ExecutionContext {

    private String processInstanceId;
    private String processDefinitionId;
    private BpmnProcess processDefinition;
    private ProcessInstanceEntity processInstance;
    private ExecutionEntity currentExecution;
    private Map<String, Object> variables = new HashMap<>();
    private String tenantId;

    public ExecutionContext() {
    }

    public ExecutionContext(String processInstanceId, String processDefinitionId,
                            BpmnProcess processDefinition, ProcessInstanceEntity processInstance,
                            ExecutionEntity currentExecution, Map<String, Object> variables,
                            String tenantId) {
        this.processInstanceId = processInstanceId;
        this.processDefinitionId = processDefinitionId;
        this.processDefinition = processDefinition;
        this.processInstance = processInstance;
        this.currentExecution = currentExecution;
        if (variables != null) {
            this.variables = new HashMap<>(variables);
        }
        this.tenantId = tenantId;
    }

    public Object getVariable(String name) {
        return variables.get(name);
    }

    public void setVariable(String name, Object value) {
        variables.put(name, value);
    }

    public void removeVariable(String name) {
        variables.remove(name);
    }
}
