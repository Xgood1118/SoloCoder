package com.bpm.engine.history.repository;

import com.bpm.engine.history.entity.HistoricActivityInstanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HistoricActivityInstanceRepository extends JpaRepository<HistoricActivityInstanceEntity, String>,
        JpaSpecificationExecutor<HistoricActivityInstanceEntity> {

    List<HistoricActivityInstanceEntity> findByProcessInstanceId(String processInstanceId);

    List<HistoricActivityInstanceEntity> findByActivityId(String activityId);

    List<HistoricActivityInstanceEntity> findByAssignee(String assignee);
}
