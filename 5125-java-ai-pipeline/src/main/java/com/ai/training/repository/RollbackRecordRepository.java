package com.ai.training.repository;

import com.ai.training.entity.RollbackRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RollbackRecordRepository extends JpaRepository<RollbackRecord, Long> {

    List<RollbackRecord> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    List<RollbackRecord> findByOperator(String operator);
}
