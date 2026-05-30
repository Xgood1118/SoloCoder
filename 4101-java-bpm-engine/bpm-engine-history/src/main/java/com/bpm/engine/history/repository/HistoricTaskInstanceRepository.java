package com.bpm.engine.history.repository;

import com.bpm.engine.common.enums.TaskStatus;
import com.bpm.engine.history.entity.HistoricTaskInstanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HistoricTaskInstanceRepository extends JpaRepository<HistoricTaskInstanceEntity, String>,
        JpaSpecificationExecutor<HistoricTaskInstanceEntity> {

    List<HistoricTaskInstanceEntity> findByProcessInstanceId(String processInstanceId);

    List<HistoricTaskInstanceEntity> findByAssigneeAndStatus(String assignee, TaskStatus status);

    List<HistoricTaskInstanceEntity> findByTenantId(String tenantId);

    Optional<HistoricTaskInstanceEntity> findByTaskInstanceId(String taskInstanceId);
}
