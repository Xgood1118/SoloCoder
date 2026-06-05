package com.ai.training.repository;

import com.ai.training.entity.ModelVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModelVersionRepository extends JpaRepository<ModelVersion, Long> {

    List<ModelVersion> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    @Query("SELECT MAX(v.versionNumber) FROM ModelVersion v WHERE v.taskId = :taskId")
    Optional<String> findLatestVersionNumberByTaskId(@Param("taskId") Long taskId);

    @Query("SELECT v FROM ModelVersion v WHERE v.taskId = :taskId ORDER BY v.createdAt DESC")
    List<ModelVersion> findLatestByTaskId(@Param("taskId") Long taskId);

    Optional<ModelVersion> findByTaskIdAndVersionNumber(Long taskId, String versionNumber);

    List<ModelVersion> findByPreviousVersionId(Long previousVersionId);
}
