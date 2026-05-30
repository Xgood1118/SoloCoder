package com.bpm.engine.history.repository;

import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.history.entity.HistoricProcessInstanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HistoricProcessInstanceRepository extends JpaRepository<HistoricProcessInstanceEntity, String>,
        JpaSpecificationExecutor<HistoricProcessInstanceEntity> {

    Optional<HistoricProcessInstanceEntity> findByProcessInstanceId(String processInstanceId);

    List<HistoricProcessInstanceEntity> findByProcessKeyAndStatus(String processKey, ProcessStatus status);

    List<HistoricProcessInstanceEntity> findByStartUserId(String startUserId);

    List<HistoricProcessInstanceEntity> findByTenantId(String tenantId);
}
