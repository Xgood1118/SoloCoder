package com.ai.training.repository;

import com.ai.training.entity.ApprovalFlow;
import com.ai.training.enums.ApprovalStatus;
import com.ai.training.enums.ModelType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApprovalFlowRepository extends JpaRepository<ApprovalFlow, Long> {

    List<ApprovalFlow> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    List<ApprovalFlow> findByStatus(ApprovalStatus status);

    List<ApprovalFlow> findByApprover(String approver);

    List<ApprovalFlow> findByModelType(ModelType modelType);

    List<ApprovalFlow> findByTaskIdAndStatus(Long taskId, ApprovalStatus status);
}
