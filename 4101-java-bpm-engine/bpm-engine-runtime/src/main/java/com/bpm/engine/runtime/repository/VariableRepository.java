package com.bpm.engine.runtime.repository;

import com.bpm.engine.runtime.entity.VariableEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VariableRepository extends JpaRepository<VariableEntity, String> {

    List<VariableEntity> findByProcessInstanceId(String processInstanceId);

    Optional<VariableEntity> findByProcessInstanceIdAndVariableName(String processInstanceId, String variableName);

    List<VariableEntity> findByExecutionId(String executionId);
}
