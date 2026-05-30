package com.bpm.engine.task.service;

import com.bpm.engine.common.enums.TaskStatus;
import com.bpm.engine.common.model.PageRequest;
import com.bpm.engine.common.model.PageResult;
import com.bpm.engine.task.entity.TaskEntity;

import java.util.List;
import java.util.Map;

public interface TaskService {

    TaskEntity createTask(String processInstanceId, String processDefinitionId, String executionId,
                          String taskDefinitionKey, String taskName, String formKey,
                          String businessKey, String tenantId);

    TaskEntity claimTask(String taskId, String userId);

    TaskEntity completeTask(String taskId, String userId, String outcome, String comment,
                            Map<String, Object> variables);

    TaskEntity rejectTask(String taskId, String userId, String reason);

    TaskEntity delegateTask(String taskId, String delegateUserId);

    TaskEntity resolveDelegation(String taskId);

    TaskEntity transferTask(String taskId, String targetUserId);

    TaskEntity addSignUser(String taskId, String userId, String operationUserId);

    TaskEntity reduceSignUser(String taskId, String userId, String operationUserId);

    void cancelTask(String taskId, String reason);

    TaskEntity getTask(String taskId);

    PageResult<TaskEntity> queryTasks(String assignee, TaskStatus status, String processInstanceId,
                                      String tenantId, PageRequest pageRequest);

    PageResult<TaskEntity> queryTodoTasks(String userId, String tenantId, PageRequest pageRequest);

    PageResult<TaskEntity> queryDoneTasks(String userId, String tenantId, PageRequest pageRequest);

    List<TaskEntity> getProcessInstanceTasks(String processInstanceId);
}
