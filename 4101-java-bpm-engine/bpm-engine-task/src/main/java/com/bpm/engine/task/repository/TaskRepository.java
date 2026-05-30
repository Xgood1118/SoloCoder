package com.bpm.engine.task.repository;

import com.bpm.engine.common.enums.TaskStatus;
import com.bpm.engine.task.entity.TaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<TaskEntity, String>, JpaSpecificationExecutor<TaskEntity> {

    List<TaskEntity> findByAssigneeAndStatus(String assignee, TaskStatus status);

    List<TaskEntity> findByProcessInstanceId(String processInstanceId);

    List<TaskEntity> findByTaskDefinitionKey(String taskDefinitionKey);

    List<TaskEntity> findByOwnerAndStatus(String owner, TaskStatus status);

    List<TaskEntity> findByDelegateUserIdAndStatus(String delegateUserId, TaskStatus status);
}
