package com.bpm.engine.runtime.service;

import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;

import java.util.List;
import java.util.Map;

public interface RuntimeService {

    ProcessInstanceEntity startProcessByKey(String processKey, String businessKey,
                                            String startUserId, Map<String, Object> variables,
                                            String tenantId);

    ProcessInstanceEntity startProcessById(String definitionId, String businessKey,
                                           String startUserId, Map<String, Object> variables,
                                           String tenantId);

    void signalExecution(String executionId, Map<String, Object> variables);

    void completeExecution(String executionId, Map<String, Object> variables);

    ExecutionEntity getExecution(String executionId);

    ProcessInstanceEntity getProcessInstance(String processInstanceId);

    List<ExecutionEntity> getActiveExecutions(String processInstanceId);

    Map<String, Object> getProcessVariables(String processInstanceId);

    void setProcessVariable(String processInstanceId, String variableName, Object value);

    Object getProcessVariable(String processInstanceId, String variableName);
}
