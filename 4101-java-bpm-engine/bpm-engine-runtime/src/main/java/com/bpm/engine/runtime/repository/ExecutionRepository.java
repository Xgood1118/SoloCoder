package com.bpm.engine.runtime.repository;

import com.bpm.engine.runtime.entity.ExecutionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExecutionRepository extends JpaRepository<ExecutionEntity, String> {

    List<ExecutionEntity> findByProcessInstanceId(String processInstanceId);

    List<ExecutionEntity> findByProcessInstanceIdAndIsActive(String processInstanceId, boolean isActive);

    List<ExecutionEntity> findByActivityId(String activityId);
}
