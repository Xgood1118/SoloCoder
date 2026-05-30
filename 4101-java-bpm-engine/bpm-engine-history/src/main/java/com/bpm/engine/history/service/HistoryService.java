package com.bpm.engine.history.service;

import com.bpm.engine.common.enums.NodeType;
import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.common.enums.TaskStatus;
import com.bpm.engine.common.enums.VariableType;
import com.bpm.engine.common.model.PageRequest;
import com.bpm.engine.common.model.PageResult;
import com.bpm.engine.history.entity.HistoricActivityInstanceEntity;
import com.bpm.engine.history.entity.HistoricProcessInstanceEntity;
import com.bpm.engine.history.entity.HistoricTaskInstanceEntity;
import com.bpm.engine.history.entity.HistoricVariableInstanceEntity;

import java.util.List;

public interface HistoryService {

    void recordProcessStart(String processInstanceId, String processDefinitionId, String processKey,
                            String processName, Integer version, String startUserId,
                            String startActivityId, String businessKey, String tenantId);

    void recordProcessEnd(String processInstanceId, ProcessStatus status, String endActivityId, String deleteReason);

    void recordActivityStart(String activityInstanceId, String processInstanceId, String processDefinitionId,
                             String executionId, String activityId, String activityName,
                             NodeType activityType, String assignee, String tenantId);

    void recordActivityEnd(String activityInstanceId, Long durationInMillis, boolean isCanceled);

    void recordTaskCreate(String taskInstanceId, String processInstanceId, String processDefinitionId,
                          String executionId, String taskDefinitionKey, String taskName,
                          String assignee, String owner, String formKey,
                          String businessKey, String tenantId);

    void recordTaskComplete(String taskInstanceId, String assignee, String delegateUserId,
                            TaskStatus status, String outcome);

    void recordVariable(String variableInstanceId, String processInstanceId, String executionId,
                        String taskId, String variableName, VariableType variableType,
                        Object value, String scope, String tenantId);

    HistoricProcessInstanceEntity getHistoricProcessInstance(String processInstanceId);

    PageResult<HistoricTaskInstanceEntity> queryHistoricTasks(String assignee, TaskStatus status,
                                                              String processInstanceId, String tenantId,
                                                              PageRequest pageRequest);

    PageResult<HistoricActivityInstanceEntity> queryHistoricActivities(String processInstanceId,
                                                                       String activityId, String assignee,
                                                                       PageRequest pageRequest);

    List<HistoricVariableInstanceEntity> getHistoricVariables(String processInstanceId);

    List<HistoricActivityInstanceEntity> getProcessAuditTrail(String processInstanceId);
}
