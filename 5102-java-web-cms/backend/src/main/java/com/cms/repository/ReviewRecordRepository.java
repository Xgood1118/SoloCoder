package com.cms.repository;

import com.cms.entity.ReviewRecord;
import com.cms.entity.ReviewStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReviewRecordRepository extends JpaRepository<ReviewRecord, String> {

    List<ReviewRecord> findByDocumentId(String documentId);

    Page<ReviewRecord> findByReviewerIdAndLevelAndStatus(String reviewerId, Integer level, ReviewStatus status, Pageable pageable);

    List<ReviewRecord> findByDocumentIdAndLevel(String documentId, Integer level);

    java.util.Optional<ReviewRecord> findByDocumentIdAndLevelAndStatus(String documentId, Integer level, ReviewStatus status);
}
