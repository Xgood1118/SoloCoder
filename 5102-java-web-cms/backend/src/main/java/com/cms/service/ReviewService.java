package com.cms.service;

import com.cms.dto.PageResponse;
import com.cms.dto.ReviewActionRequest;
import com.cms.dto.ReviewRecordDTO;
import com.cms.entity.Document;
import com.cms.entity.DocumentStatus;
import com.cms.entity.ReviewConfig;
import com.cms.entity.ReviewRecord;
import com.cms.entity.ReviewStatus;
import com.cms.entity.User;
import com.cms.entity.UserRole;
import com.cms.repository.DocumentRepository;
import com.cms.repository.ReviewConfigRepository;
import com.cms.repository.ReviewRecordRepository;
import com.cms.repository.UserRepository;
import com.cms.repository.CategoryRepository;
import com.cms.entity.Category;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRecordRepository reviewRecordRepository;
    private final ReviewConfigRepository reviewConfigRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;

    private ReviewConfig findConfigForCategory(String categoryId) {
        String currentId = categoryId;
        while (currentId != null) {
            ReviewConfig config = reviewConfigRepository.findByCategoryId(currentId).orElse(null);
            if (config != null) {
                return config;
            }
            Category cat = categoryRepository.findById(currentId).orElse(null);
            currentId = (cat != null) ? cat.getParentId() : null;
        }
        throw new RuntimeException("No review config found for category: " + categoryId);
    }

    @Transactional
    public ReviewRecordDTO submitForReview(String documentId) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));
        if (doc.getStatus() != DocumentStatus.DRAFT && doc.getStatus() != DocumentStatus.REJECTED) {
            throw new RuntimeException("Document must be in DRAFT or REJECTED status to submit for review");
        }
        ReviewConfig config = findConfigForCategory(doc.getCategoryId());
        if (!config.getEnabled()) {
            throw new RuntimeException("Review is not enabled for this category");
        }
        doc.setStatus(DocumentStatus.PENDING_REVIEW);
        documentRepository.save(doc);

        User level1Reviewer = userRepository.findByRole(config.getLevel1ReviewerRole()).stream()
                .filter(User::getEnabled)
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No available reviewer for level 1 with role: " + config.getLevel1ReviewerRole()));
        ReviewRecord record1 = new ReviewRecord();
        record1.setDocumentId(documentId);
        record1.setReviewerId(level1Reviewer.getId());
        record1.setLevel(1);
        record1.setStatus(ReviewStatus.PENDING);
        reviewRecordRepository.save(record1);

        if (config.getReviewLevels() >= 2) {
            User level2Reviewer = userRepository.findByRole(config.getLevel2ReviewerRole()).stream()
                    .filter(User::getEnabled)
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("No available reviewer for level 2 with role: " + config.getLevel2ReviewerRole()));
            ReviewRecord record2 = new ReviewRecord();
            record2.setDocumentId(documentId);
            record2.setReviewerId(level2Reviewer.getId());
            record2.setLevel(2);
            record2.setStatus(ReviewStatus.PENDING);
            reviewRecordRepository.save(record2);
        }
        return toDTO(record1);
    }

    public PageResponse<ReviewRecordDTO> getPendingReviews(String reviewerId, int level, int page, int pageSize) {
        PageRequest pageable = PageRequest.of(page - 1, pageSize);
        Page<ReviewRecord> records = reviewRecordRepository
                .findByReviewerIdAndLevelAndStatus(reviewerId, level, ReviewStatus.PENDING, pageable);
        List<ReviewRecordDTO> items = records.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return new PageResponse<>(items, records.getTotalElements(), page, pageSize, records.getTotalPages());
    }

    @Transactional
    public ReviewRecordDTO approveReview(ReviewActionRequest request, String reviewerId) {
        ReviewRecord record;
        if (request.getReviewRecordId() != null) {
            record = reviewRecordRepository.findById(request.getReviewRecordId())
                    .orElseThrow(() -> new RuntimeException("Review record not found: " + request.getReviewRecordId()));
        } else if (request.getDocumentId() != null && request.getLevel() != null) {
            record = reviewRecordRepository.findByDocumentIdAndLevelAndStatus(
                            request.getDocumentId(), request.getLevel(), ReviewStatus.PENDING)
                    .orElseThrow(() -> new RuntimeException("No pending review record found for document: " + request.getDocumentId()));
        } else {
            throw new RuntimeException("Either reviewRecordId or documentId + level must be provided");
        }
        if (!record.getReviewerId().equals(reviewerId)) {
            throw new RuntimeException("Only the assigned reviewer can approve this review");
        }
        if (record.getStatus() != ReviewStatus.PENDING) {
            throw new RuntimeException("Review record is not in PENDING status");
        }
        record.setStatus(ReviewStatus.APPROVED);
        record.setComment(request.getComment());
        record.setReviewedAt(LocalDateTime.now());
        reviewRecordRepository.save(record);

        ReviewConfig config = findConfigForCategory(
                documentRepository.findById(record.getDocumentId())
                        .orElseThrow(() -> new RuntimeException("Document not found"))
                        .getCategoryId()
        );

        if (config.getReviewLevels() >= 2 && record.getLevel() == 1) {
            // Level 1 approved - level 2 record is already PENDING and active
            return toDTO(record);
        }

        boolean allApproved = true;
        List<ReviewRecord> allRecords = reviewRecordRepository.findByDocumentId(record.getDocumentId());
        for (ReviewRecord r : allRecords) {
            if (r.getStatus() == ReviewStatus.PENDING || r.getStatus() == ReviewStatus.REJECTED) {
                allApproved = false;
                break;
            }
        }
        if (allApproved) {
            Document doc = documentRepository.findById(record.getDocumentId())
                    .orElseThrow(() -> new RuntimeException("Document not found"));
            doc.setStatus(DocumentStatus.PUBLISHED);
            documentRepository.save(doc);
        }
        return toDTO(record);
    }

    @Transactional
    public ReviewRecordDTO rejectReview(ReviewActionRequest request, String reviewerId) {
        ReviewRecord record;
        if (request.getReviewRecordId() != null) {
            record = reviewRecordRepository.findById(request.getReviewRecordId())
                    .orElseThrow(() -> new RuntimeException("Review record not found: " + request.getReviewRecordId()));
        } else if (request.getDocumentId() != null && request.getLevel() != null) {
            record = reviewRecordRepository.findByDocumentIdAndLevelAndStatus(
                            request.getDocumentId(), request.getLevel(), ReviewStatus.PENDING)
                    .orElseThrow(() -> new RuntimeException("No pending review record found for document: " + request.getDocumentId()));
        } else {
            throw new RuntimeException("Either reviewRecordId or documentId + level must be provided");
        }
        if (!record.getReviewerId().equals(reviewerId)) {
            throw new RuntimeException("Only the assigned reviewer can reject this review");
        }
        if (record.getStatus() != ReviewStatus.PENDING) {
            throw new RuntimeException("Review record is not in PENDING status");
        }
        record.setStatus(ReviewStatus.REJECTED);
        record.setComment(request.getComment());
        record.setReviewedAt(LocalDateTime.now());
        reviewRecordRepository.save(record);

        Document doc = documentRepository.findById(record.getDocumentId())
                .orElseThrow(() -> new RuntimeException("Document not found"));
        doc.setStatus(DocumentStatus.REJECTED);
        documentRepository.save(doc);

        return toDTO(record);
    }

    @Transactional
    public void resubmitForReview(String documentId) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));
        if (doc.getStatus() != DocumentStatus.REJECTED) {
            throw new RuntimeException("Only REJECTED documents can be resubmitted for review");
        }
        doc.setStatus(DocumentStatus.PENDING_REVIEW);
        documentRepository.save(doc);

        ReviewConfig config = findConfigForCategory(doc.getCategoryId());

        User level1Reviewer = userRepository.findByRole(config.getLevel1ReviewerRole()).stream()
                .filter(User::getEnabled)
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No available reviewer for level 1"));
        ReviewRecord record1 = new ReviewRecord();
        record1.setDocumentId(documentId);
        record1.setReviewerId(level1Reviewer.getId());
        record1.setLevel(1);
        record1.setStatus(ReviewStatus.PENDING);
        reviewRecordRepository.save(record1);

        if (config.getReviewLevels() >= 2) {
            User level2Reviewer = userRepository.findByRole(config.getLevel2ReviewerRole()).stream()
                    .filter(User::getEnabled)
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("No available reviewer for level 2"));
            ReviewRecord record2 = new ReviewRecord();
            record2.setDocumentId(documentId);
            record2.setReviewerId(level2Reviewer.getId());
            record2.setLevel(2);
            record2.setStatus(ReviewStatus.PENDING);
            reviewRecordRepository.save(record2);
        }
    }

    public List<ReviewRecordDTO> getReviewHistory(String documentId) {
        return reviewRecordRepository.findByDocumentId(documentId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private ReviewRecordDTO toDTO(ReviewRecord record) {
        ReviewRecordDTO dto = new ReviewRecordDTO();
        dto.setId(record.getId());
        dto.setDocumentId(record.getDocumentId());
        dto.setReviewerId(record.getReviewerId());
        dto.setLevel(record.getLevel());
        dto.setStatus(record.getStatus());
        dto.setComment(record.getComment());
        dto.setReviewedAt(record.getReviewedAt());
        dto.setCreatedAt(record.getCreatedAt());
        dto.setUpdatedAt(record.getUpdatedAt());
        return dto;
    }
}
