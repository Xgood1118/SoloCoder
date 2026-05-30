package com.bpm.engine.history.service;

import com.bpm.engine.common.enums.NodeType;
import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.common.enums.TaskStatus;
import com.bpm.engine.common.enums.VariableType;
import com.bpm.engine.common.exception.BpmEngineException;
import com.bpm.engine.common.model.PageRequest;
import com.bpm.engine.common.model.PageResult;
import com.bpm.engine.common.util.JsonUtils;
import com.bpm.engine.history.entity.HistoricActivityInstanceEntity;
import com.bpm.engine.history.entity.HistoricProcessInstanceEntity;
import com.bpm.engine.history.entity.HistoricTaskInstanceEntity;
import com.bpm.engine.history.entity.HistoricVariableInstanceEntity;
import com.bpm.engine.history.repository.HistoricActivityInstanceRepository;
import com.bpm.engine.history.repository.HistoricProcessInstanceRepository;
import com.bpm.engine.history.repository.HistoricTaskInstanceRepository;
import com.bpm.engine.history.repository.HistoricVariableInstanceRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class HistoryServiceImpl implements HistoryService {

    private final HistoricProcessInstanceRepository processInstanceRepository;
    private final HistoricActivityInstanceRepository activityInstanceRepository;
    private final HistoricTaskInstanceRepository taskInstanceRepository;
    private final HistoricVariableInstanceRepository variableInstanceRepository;

    @Override
    @Transactional
    public void recordProcessStart(String processInstanceId, String processDefinitionId, String processKey,
                                   String processName, Integer version, String startUserId,
                                   String startActivityId, String businessKey, String tenantId) {
        HistoricProcessInstanceEntity entity = new HistoricProcessInstanceEntity();
        entity.setProcessInstanceId(processInstanceId);
        entity.setProcessDefinitionId(processDefinitionId);
        entity.setProcessKey(processKey);
        entity.setProcessName(processName);
        entity.setVersion(version);
        entity.setStatus(ProcessStatus.RUNNING);
        entity.setStartUserId(startUserId);
        entity.setStartTime(LocalDateTime.now());
        entity.setStartActivityId(startActivityId);
        entity.setBusinessKey(businessKey);
        entity.setTenantId(tenantId);
        processInstanceRepository.save(entity);
    }

    @Override
    @Transactional
    public void recordProcessEnd(String processInstanceId, ProcessStatus status, String endActivityId,
                                 String deleteReason) {
        HistoricProcessInstanceEntity entity = processInstanceRepository
                .findByProcessInstanceId(processInstanceId)
                .orElseThrow(() -> new BpmEngineException("PROCESS_NOT_FOUND",
                        "Historic process instance not found: " + processInstanceId));
        entity.setStatus(status);
        entity.setEndTime(LocalDateTime.now());
        entity.setEndActivityId(endActivityId);
        entity.setDeleteReason(deleteReason);
        if (entity.getStartTime() != null) {
            entity.setDurationInMillis(java.time.Duration.between(entity.getStartTime(), entity.getEndTime()).toMillis());
        }
        processInstanceRepository.save(entity);
    }

    @Override
    @Transactional
    public void recordActivityStart(String activityInstanceId, String processInstanceId, String processDefinitionId,
                                    String executionId, String activityId, String activityName,
                                    NodeType activityType, String assignee, String tenantId) {
        HistoricActivityInstanceEntity entity = new HistoricActivityInstanceEntity();
        entity.setActivityInstanceId(activityInstanceId);
        entity.setProcessInstanceId(processInstanceId);
        entity.setProcessDefinitionId(processDefinitionId);
        entity.setExecutionId(executionId);
        entity.setActivityId(activityId);
        entity.setActivityName(activityName);
        entity.setActivityType(activityType);
        entity.setAssignee(assignee);
        entity.setStartTime(LocalDateTime.now());
        entity.setCanceled(false);
        entity.setTenantId(tenantId);
        activityInstanceRepository.save(entity);
    }

    @Override
    @Transactional
    public void recordActivityEnd(String activityInstanceId, Long durationInMillis, boolean isCanceled) {
        List<HistoricActivityInstanceEntity> entities = activityInstanceRepository
                .findByProcessInstanceId(activityInstanceId)
                .stream()
                .filter(e -> activityInstanceId.equals(e.getActivityInstanceId()))
                .toList();
        if (entities.isEmpty()) {
            throw new BpmEngineException("ACTIVITY_NOT_FOUND",
                    "Historic activity instance not found: " + activityInstanceId);
        }
        HistoricActivityInstanceEntity entity = entities.get(0);
        entity.setEndTime(LocalDateTime.now());
        entity.setDurationInMillis(durationInMillis);
        entity.setCanceled(isCanceled);
        activityInstanceRepository.save(entity);
    }

    @Override
    @Transactional
    public void recordTaskCreate(String taskInstanceId, String processInstanceId, String processDefinitionId,
                                 String executionId, String taskDefinitionKey, String taskName,
                                 String assignee, String owner, String formKey,
                                 String businessKey, String tenantId) {
        HistoricTaskInstanceEntity entity = new HistoricTaskInstanceEntity();
        entity.setTaskInstanceId(taskInstanceId);
        entity.setProcessInstanceId(processInstanceId);
        entity.setProcessDefinitionId(processDefinitionId);
        entity.setExecutionId(executionId);
        entity.setTaskDefinitionKey(taskDefinitionKey);
        entity.setTaskName(taskName);
        entity.setAssignee(assignee);
        entity.setOwner(owner);
        entity.setStatus(TaskStatus.CREATED);
        entity.setCreateTime(LocalDateTime.now());
        entity.setFormKey(formKey);
        entity.setBusinessKey(businessKey);
        entity.setTenantId(tenantId);
        taskInstanceRepository.save(entity);
    }

    @Override
    @Transactional
    public void recordTaskComplete(String taskInstanceId, String assignee, String delegateUserId,
                                   TaskStatus status, String outcome) {
        HistoricTaskInstanceEntity entity = taskInstanceRepository
                .findByTaskInstanceId(taskInstanceId)
                .orElseThrow(() -> new BpmEngineException("TASK_NOT_FOUND",
                        "Historic task instance not found: " + taskInstanceId));
        entity.setAssignee(assignee);
        entity.setDelegateUserId(delegateUserId);
        entity.setStatus(status);
        entity.setOutcome(outcome);
        entity.setCompleteTime(LocalDateTime.now());
        if (entity.getCreateTime() != null) {
            entity.setDurationInMillis(java.time.Duration.between(entity.getCreateTime(), entity.getCompleteTime()).toMillis());
        }
        taskInstanceRepository.save(entity);
    }

    @Override
    @Transactional
    public void recordVariable(String variableInstanceId, String processInstanceId, String executionId,
                               String taskId, String variableName, VariableType variableType,
                               Object value, String scope, String tenantId) {
        HistoricVariableInstanceEntity entity = new HistoricVariableInstanceEntity();
        entity.setVariableInstanceId(variableInstanceId);
        entity.setProcessInstanceId(processInstanceId);
        entity.setExecutionId(executionId);
        entity.setTaskId(taskId);
        entity.setVariableName(variableName);
        entity.setVariableType(variableType);
        entity.setScope(scope);
        entity.setTenantId(tenantId);
        setVariableValue(entity, variableType, value);
        variableInstanceRepository.save(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public HistoricProcessInstanceEntity getHistoricProcessInstance(String processInstanceId) {
        return processInstanceRepository.findByProcessInstanceId(processInstanceId).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<HistoricTaskInstanceEntity> queryHistoricTasks(String assignee, TaskStatus status,
                                                                     String processInstanceId, String tenantId,
                                                                     PageRequest pageRequest) {
        Specification<HistoricTaskInstanceEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (assignee != null && !assignee.isEmpty()) {
                predicates.add(cb.equal(root.get("assignee"), assignee));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (processInstanceId != null && !processInstanceId.isEmpty()) {
                predicates.add(cb.equal(root.get("processInstanceId"), processInstanceId));
            }
            if (tenantId != null && !tenantId.isEmpty()) {
                predicates.add(cb.equal(root.get("tenantId"), tenantId));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        org.springframework.data.domain.PageRequest springPageRequest = org.springframework.data.domain.PageRequest
                .of(pageRequest.getPageNum() - 1, pageRequest.getPageSize());
        Page<HistoricTaskInstanceEntity> page = taskInstanceRepository.findAll(spec, springPageRequest);
        return new PageResult<>(page.getContent(), page.getTotalElements(),
                pageRequest.getPageNum(), pageRequest.getPageSize());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<HistoricActivityInstanceEntity> queryHistoricActivities(String processInstanceId,
                                                                              String activityId, String assignee,
                                                                              PageRequest pageRequest) {
        Specification<HistoricActivityInstanceEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (processInstanceId != null && !processInstanceId.isEmpty()) {
                predicates.add(cb.equal(root.get("processInstanceId"), processInstanceId));
            }
            if (activityId != null && !activityId.isEmpty()) {
                predicates.add(cb.equal(root.get("activityId"), activityId));
            }
            if (assignee != null && !assignee.isEmpty()) {
                predicates.add(cb.equal(root.get("assignee"), assignee));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        org.springframework.data.domain.PageRequest springPageRequest = org.springframework.data.domain.PageRequest
                .of(pageRequest.getPageNum() - 1, pageRequest.getPageSize());
        Page<HistoricActivityInstanceEntity> page = activityInstanceRepository.findAll(spec, springPageRequest);
        return new PageResult<>(page.getContent(), page.getTotalElements(),
                pageRequest.getPageNum(), pageRequest.getPageSize());
    }

    @Override
    @Transactional(readOnly = true)
    public List<HistoricVariableInstanceEntity> getHistoricVariables(String processInstanceId) {
        return variableInstanceRepository.findByProcessInstanceId(processInstanceId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<HistoricActivityInstanceEntity> getProcessAuditTrail(String processInstanceId) {
        return activityInstanceRepository.findByProcessInstanceId(processInstanceId);
    }

    private void setVariableValue(HistoricVariableInstanceEntity entity, VariableType variableType, Object value) {
        if (value == null) {
            return;
        }
        switch (variableType) {
            case STRING -> entity.setTextValue((String) value);
            case INTEGER, LONG -> entity.setLongValue(((Number) value).longValue());
            case DOUBLE -> entity.setDoubleValue(((Number) value).doubleValue());
            case BOOLEAN -> entity.setTextValue(value.toString());
            case DATE -> {
                if (value instanceof LocalDateTime ldt) {
                    entity.setDateValue(ldt);
                } else {
                    entity.setTextValue(value.toString());
                }
            }
            case JSON, OBJECT -> entity.setJsonValue(JsonUtils.toJson(value));
        }
    }
}
