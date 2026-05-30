package com.bpm.engine.task.repository;

import com.bpm.engine.task.entity.TaskDelegateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskDelegateRepository extends JpaRepository<TaskDelegateEntity, String> {

    List<TaskDelegateEntity> findByTaskId(String taskId);

    List<TaskDelegateEntity> findByOriginalAssignee(String originalAssignee);

    List<TaskDelegateEntity> findByDelegateUserIdAndIsResolved(String delegateUserId, boolean isResolved);
}
