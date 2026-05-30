package com.bpm.engine.runtime.repository;

import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessInstanceRepository extends JpaRepository<ProcessInstanceEntity, String> {

    List<ProcessInstanceEntity> findByProcessDefinitionId(String processDefinitionId);

    List<ProcessInstanceEntity> findByProcessKeyAndStatus(String processKey, ProcessStatus status);

    List<ProcessInstanceEntity> findByBusinessKey(String businessKey);

    List<ProcessInstanceEntity> findByStartUserId(String startUserId);
}
