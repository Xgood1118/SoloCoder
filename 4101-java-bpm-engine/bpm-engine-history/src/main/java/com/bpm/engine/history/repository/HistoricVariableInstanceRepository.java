package com.bpm.engine.history.repository;

import com.bpm.engine.history.entity.HistoricVariableInstanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HistoricVariableInstanceRepository extends JpaRepository<HistoricVariableInstanceEntity, String>,
        JpaSpecificationExecutor<HistoricVariableInstanceEntity> {

    List<HistoricVariableInstanceEntity> findByProcessInstanceId(String processInstanceId);

    Optional<HistoricVariableInstanceEntity> findByProcessInstanceIdAndVariableName(String processInstanceId, String variableName);
}
