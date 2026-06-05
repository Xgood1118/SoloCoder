package com.ai.training.repository;

import com.ai.training.entity.ApprovalConfig;
import com.ai.training.enums.ModelType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ApprovalConfigRepository extends JpaRepository<ApprovalConfig, Long> {

    Optional<ApprovalConfig> findByModelType(ModelType modelType);
}
