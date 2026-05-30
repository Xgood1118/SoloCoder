package com.featureflag.repository;

import com.featureflag.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findByFlagKeyOrderByCreatedAtDesc(String flagKey, Pageable pageable);

    List<AuditLog> findByFlagKeyAndCreatedAtBetween(String flagKey, LocalDateTime start, LocalDateTime end);

    List<AuditLog> findByOperatorOrderByCreatedAtDesc(String operator);
}
