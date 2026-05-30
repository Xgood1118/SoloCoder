package com.bpm.engine.task.service;

import com.bpm.engine.common.enums.DelegationType;
import com.bpm.engine.common.enums.TaskStatus;
import com.bpm.engine.common.exception.TaskOperationException;
import com.bpm.engine.common.model.PageRequest;
import com.bpm.engine.common.model.PageResult;
import com.bpm.engine.runtime.delegation.DelegationService;
import com.bpm.engine.runtime.service.RuntimeService;
import com.bpm.engine.task.entity.TaskDelegateEntity;
import com.bpm.engine.task.entity.TaskEntity;
import com.bpm.engine.task.entity.TaskSignDataEntity;
import com.bpm.engine.task.repository.TaskDelegateRepository;
import com.bpm.engine.task.repository.TaskRepository;
import com.bpm.engine.task.repository.TaskSignDataRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private final TaskRepository taskRepository;
    private final TaskSignDataRepository taskSignDataRepository;
    private final TaskDelegateRepository taskDelegateRepository;
    private final RuntimeService runtimeService;
    private final DelegationService delegationService;

    @Override
    @Transactional
    public TaskEntity createTask(String processInstanceId, String processDefinitionId, String executionId,
                                 String taskDefinitionKey, String taskName, String formKey,
                                 String businessKey, String tenantId) {
        TaskEntity task = new TaskEntity();
        task.setProcessInstanceId(processInstanceId);
        task.setProcessDefinitionId(processDefinitionId);
        task.setExecutionId(executionId);
        task.setTaskDefinitionKey(taskDefinitionKey);
        task.setTaskName(taskName);
        task.setFormKey(formKey);
        task.setBusinessKey(businessKey);
        task.setTenantId(tenantId);
        task.setStatus(TaskStatus.CREATED);
        task.setPriority(50);

        String resolvedAssignee = delegationService.resolveDelegatedUser(null, processDefinitionId);
        if (resolvedAssignee != null) {
            task.setAssignee(resolvedAssignee);
        }

        return taskRepository.save(task);
    }

    @Override
    @Transactional
    public TaskEntity claimTask(String taskId, String userId) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() != TaskStatus.CREATED) {
            throw new TaskOperationException("TASK_ALREADY_CLAIMED",
                    "Task cannot be claimed, current status: " + task.getStatus());
        }
        task.setAssignee(userId);
        task.setStatus(TaskStatus.CLAIMED);
        task.setClaimTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    @Transactional
    public TaskEntity completeTask(String taskId, String userId, String outcome, String comment,
                                   Map<String, Object> variables) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() != TaskStatus.CLAIMED && task.getStatus() != TaskStatus.CREATED) {
            throw new TaskOperationException("TASK_CANNOT_COMPLETE",
                    "Task cannot be completed, current status: " + task.getStatus());
        }
        if (!userId.equals(task.getAssignee())) {
            throw new TaskOperationException("TASK_NOT_ASSIGNEE",
                    "User " + userId + " is not the assignee of task " + taskId);
        }
        task.setStatus(TaskStatus.COMPLETED);
        task.setCompleteTime(LocalDateTime.now());
        task.setOutcome(outcome);
        task.setComment(comment);
        taskRepository.save(task);

        if (variables != null && !variables.isEmpty()) {
            for (Map.Entry<String, Object> entry : variables.entrySet()) {
                runtimeService.setProcessVariable(task.getProcessInstanceId(), entry.getKey(), entry.getValue());
            }
        }
        runtimeService.completeExecution(task.getExecutionId(), variables);

        return task;
    }

    @Override
    @Transactional
    public TaskEntity rejectTask(String taskId, String userId, String reason) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() != TaskStatus.CLAIMED && task.getStatus() != TaskStatus.CREATED) {
            throw new TaskOperationException("TASK_CANNOT_REJECT",
                    "Task cannot be rejected, current status: " + task.getStatus());
        }
        if (!userId.equals(task.getAssignee())) {
            throw new TaskOperationException("TASK_NOT_ASSIGNEE",
                    "User " + userId + " is not the assignee of task " + taskId);
        }
        task.setStatus(TaskStatus.REJECTED);
        task.setCompleteTime(LocalDateTime.now());
        task.setOutcome("reject");
        task.setComment(reason);
        return taskRepository.save(task);
    }

    @Override
    @Transactional
    public TaskEntity delegateTask(String taskId, String delegateUserId) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() == TaskStatus.COMPLETED || task.getStatus() == TaskStatus.CANCELLED) {
            throw new TaskOperationException("TASK_CANNOT_DELEGATE",
                    "Task cannot be delegated, current status: " + task.getStatus());
        }

        String originalAssignee = task.getAssignee();
        task.setOwner(originalAssignee);
        task.setAssignee(delegateUserId);
        task.setDelegateUserId(delegateUserId);
        task.setStatus(TaskStatus.DELEGATED);

        TaskDelegateEntity delegateEntity = new TaskDelegateEntity();
        delegateEntity.setTaskId(taskId);
        delegateEntity.setOriginalAssignee(originalAssignee);
        delegateEntity.setDelegateUserId(delegateUserId);
        delegateEntity.setDelegationType(DelegationType.DELEGATE);
        delegateEntity.setDelegateTime(LocalDateTime.now());
        delegateEntity.setResolved(false);
        delegateEntity.setTenantId(task.getTenantId());
        taskDelegateRepository.save(delegateEntity);

        return taskRepository.save(task);
    }

    @Override
    @Transactional
    public TaskEntity resolveDelegation(String taskId) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() != TaskStatus.DELEGATED) {
            throw new TaskOperationException("TASK_NOT_DELEGATED",
                    "Task is not in delegated state, current status: " + task.getStatus());
        }

        String owner = task.getOwner();
        task.setAssignee(owner);
        task.setDelegateUserId(null);
        task.setOwner(null);
        task.setStatus(TaskStatus.CLAIMED);

        List<TaskDelegateEntity> delegates = taskDelegateRepository.findByTaskId(taskId);
        for (TaskDelegateEntity delegate : delegates) {
            if (!delegate.isResolved()) {
                delegate.setResolved(true);
                delegate.setResolveTime(LocalDateTime.now());
                taskDelegateRepository.save(delegate);
            }
        }

        return taskRepository.save(task);
    }

    @Override
    @Transactional
    public TaskEntity transferTask(String taskId, String targetUserId) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() == TaskStatus.COMPLETED || task.getStatus() == TaskStatus.CANCELLED) {
            throw new TaskOperationException("TASK_CANNOT_TRANSFER",
                    "Task cannot be transferred, current status: " + task.getStatus());
        }

        String originalAssignee = task.getAssignee();
        task.setOwner(originalAssignee);
        task.setAssignee(targetUserId);
        task.setStatus(TaskStatus.TRANSFERRED);

        TaskDelegateEntity transferEntity = new TaskDelegateEntity();
        transferEntity.setTaskId(taskId);
        transferEntity.setOriginalAssignee(originalAssignee);
        transferEntity.setDelegateUserId(targetUserId);
        transferEntity.setDelegationType(DelegationType.SUBSTITUTE);
        transferEntity.setDelegateTime(LocalDateTime.now());
        transferEntity.setResolved(true);
        transferEntity.setTenantId(task.getTenantId());
        taskDelegateRepository.save(transferEntity);

        return taskRepository.save(task);
    }

    @Override
    @Transactional
    public TaskEntity addSignUser(String taskId, String userId, String operationUserId) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() == TaskStatus.COMPLETED || task.getStatus() == TaskStatus.CANCELLED) {
            throw new TaskOperationException("TASK_CANNOT_ADD_SIGN",
                    "Cannot add sign user to task, current status: " + task.getStatus());
        }

        TaskSignDataEntity signData = new TaskSignDataEntity();
        signData.setTaskId(taskId);
        signData.setUserId(userId);
        signData.setSignType("ADD");
        signData.setOperationUserId(operationUserId);
        signData.setOperateTime(LocalDateTime.now());
        signData.setTenantId(task.getTenantId());
        taskSignDataRepository.save(signData);

        TaskEntity newTask = new TaskEntity();
        newTask.setProcessInstanceId(task.getProcessInstanceId());
        newTask.setProcessDefinitionId(task.getProcessDefinitionId());
        newTask.setExecutionId(task.getExecutionId());
        newTask.setTaskDefinitionKey(task.getTaskDefinitionKey());
        newTask.setTaskName(task.getTaskName());
        newTask.setFormKey(task.getFormKey());
        newTask.setBusinessKey(task.getBusinessKey());
        newTask.setAssignee(userId);
        newTask.setStatus(TaskStatus.CREATED);
        newTask.setPriority(task.getPriority());
        newTask.setTenantId(task.getTenantId());
        taskRepository.save(newTask);

        return task;
    }

    @Override
    @Transactional
    public TaskEntity reduceSignUser(String taskId, String userId, String operationUserId) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() == TaskStatus.COMPLETED || task.getStatus() == TaskStatus.CANCELLED) {
            throw new TaskOperationException("TASK_CANNOT_REDUCE_SIGN",
                    "Cannot reduce sign user from task, current status: " + task.getStatus());
        }

        TaskSignDataEntity signData = new TaskSignDataEntity();
        signData.setTaskId(taskId);
        signData.setUserId(userId);
        signData.setSignType("REDUCE");
        signData.setOperationUserId(operationUserId);
        signData.setOperateTime(LocalDateTime.now());
        signData.setTenantId(task.getTenantId());
        taskSignDataRepository.save(signData);

        List<TaskEntity> pendingTasks = taskRepository.findByProcessInstanceId(task.getProcessInstanceId());
        for (TaskEntity pendingTask : pendingTasks) {
            if (userId.equals(pendingTask.getAssignee())
                    && pendingTask.getTaskDefinitionKey().equals(task.getTaskDefinitionKey())
                    && (pendingTask.getStatus() == TaskStatus.CREATED || pendingTask.getStatus() == TaskStatus.CLAIMED)) {
                pendingTask.setStatus(TaskStatus.CANCELLED);
                pendingTask.setComment("Reduced by sign operation");
                taskRepository.save(pendingTask);
                break;
            }
        }

        return task;
    }

    @Override
    @Transactional
    public void cancelTask(String taskId, String reason) {
        TaskEntity task = getTaskOrThrow(taskId);
        if (task.getStatus() == TaskStatus.COMPLETED) {
            throw new TaskOperationException("TASK_ALREADY_COMPLETED",
                    "Completed task cannot be cancelled");
        }
        task.setStatus(TaskStatus.CANCELLED);
        task.setComment(reason);
        taskRepository.save(task);
    }

    @Override
    public TaskEntity getTask(String taskId) {
        return taskRepository.findById(taskId).orElse(null);
    }

    @Override
    public PageResult<TaskEntity> queryTasks(String assignee, TaskStatus status, String processInstanceId,
                                             String tenantId, PageRequest pageRequest) {
        Specification<TaskEntity> spec = (root, query, cb) -> {
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
            predicates.add(cb.isFalse(root.get("deleted")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        org.springframework.data.domain.PageRequest springPageRequest =
                org.springframework.data.domain.PageRequest.of(pageRequest.getPageNum() - 1, pageRequest.getPageSize());
        Page<TaskEntity> page = taskRepository.findAll(spec, springPageRequest);

        return new PageResult<>(page.getContent(), page.getTotalElements(),
                page.getNumber() + 1, page.getSize());
    }

    @Override
    public PageResult<TaskEntity> queryTodoTasks(String userId, String tenantId, PageRequest pageRequest) {
        Specification<TaskEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("assignee"), userId));
            predicates.add(cb.or(
                    cb.equal(root.get("status"), TaskStatus.CREATED),
                    cb.equal(root.get("status"), TaskStatus.CLAIMED),
                    cb.equal(root.get("status"), TaskStatus.DELEGATED)
            ));
            if (tenantId != null && !tenantId.isEmpty()) {
                predicates.add(cb.equal(root.get("tenantId"), tenantId));
            }
            predicates.add(cb.isFalse(root.get("deleted")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        org.springframework.data.domain.PageRequest springPageRequest =
                org.springframework.data.domain.PageRequest.of(pageRequest.getPageNum() - 1, pageRequest.getPageSize());
        Page<TaskEntity> page = taskRepository.findAll(spec, springPageRequest);

        return new PageResult<>(page.getContent(), page.getTotalElements(),
                page.getNumber() + 1, page.getSize());
    }

    @Override
    public PageResult<TaskEntity> queryDoneTasks(String userId, String tenantId, PageRequest pageRequest) {
        Specification<TaskEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("assignee"), userId));
            predicates.add(cb.or(
                    cb.equal(root.get("status"), TaskStatus.COMPLETED),
                    cb.equal(root.get("status"), TaskStatus.REJECTED)
            ));
            if (tenantId != null && !tenantId.isEmpty()) {
                predicates.add(cb.equal(root.get("tenantId"), tenantId));
            }
            predicates.add(cb.isFalse(root.get("deleted")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        org.springframework.data.domain.PageRequest springPageRequest =
                org.springframework.data.domain.PageRequest.of(pageRequest.getPageNum() - 1, pageRequest.getPageSize());
        Page<TaskEntity> page = taskRepository.findAll(spec, springPageRequest);

        return new PageResult<>(page.getContent(), page.getTotalElements(),
                page.getNumber() + 1, page.getSize());
    }

    @Override
    public List<TaskEntity> getProcessInstanceTasks(String processInstanceId) {
        return taskRepository.findByProcessInstanceId(processInstanceId);
    }

    private TaskEntity getTaskOrThrow(String taskId) {
        TaskEntity task = taskRepository.findById(taskId).orElse(null);
        if (task == null) {
            throw new TaskOperationException("TASK_NOT_FOUND", "Task not found: " + taskId);
        }
        return task;
    }
}
