package com.bpm.engine.bpmn.repository;

import com.bpm.engine.bpmn.repository.ProcessDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProcessDefinitionRepository extends JpaRepository<ProcessDefinitionEntity, String> {

    List<ProcessDefinitionEntity> findByProcessKey(String processKey);

    Optional<ProcessDefinitionEntity> findByProcessKeyAndVersion(String processKey, int version);

    @Query("SELECT p FROM ProcessDefinitionEntity p WHERE p.processKey = :processKey AND p.deleted = false ORDER BY p.version DESC LIMIT 1")
    Optional<ProcessDefinitionEntity> findLatestVersionByProcessKey(@Param("processKey") String processKey);

    List<ProcessDefinitionEntity> findByDeploymentId(String deploymentId);
}
