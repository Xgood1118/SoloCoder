package com.cms.service;

import com.cms.dto.DocumentCreateRequest;
import com.cms.dto.DocumentDTO;
import com.cms.dto.DocumentFilterRequest;
import com.cms.dto.DocumentUpdateRequest;
import com.cms.dto.PageResponse;
import com.cms.dto.TagDTO;
import com.cms.entity.Document;
import com.cms.entity.DocumentStatus;
import com.cms.entity.ReviewRecord;
import com.cms.entity.ReviewStatus;
import com.cms.entity.Tag;
import com.cms.repository.DocumentRepository;
import com.cms.repository.ReviewConfigRepository;
import com.cms.repository.ReviewRecordRepository;
import com.cms.repository.TagRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final TagRepository tagRepository;
    private final ReviewConfigRepository reviewConfigRepository;
    private final ReviewRecordRepository reviewRecordRepository;

    @Transactional(readOnly = true)
    public PageResponse<DocumentDTO> getDocuments(DocumentFilterRequest filter) {
        Specification<Document> spec = buildSpecification(filter);
        PageRequest pageable = PageRequest.of(filter.getPage() - 1, filter.getPageSize());
        Page<Document> page = documentRepository.findAll(spec, pageable);
        List<DocumentDTO> items = page.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return new PageResponse<>(items, page.getTotalElements(), filter.getPage(), filter.getPageSize(), page.getTotalPages());
    }

    @Transactional
    public DocumentDTO getDocumentById(String id) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found: " + id));
        doc.setViewCount(doc.getViewCount() + 1);
        documentRepository.save(doc);
        return toDTO(doc);
    }

    public DocumentDTO createDocument(DocumentCreateRequest request, String authorId) {
        Document doc = new Document();
        doc.setTitle(request.getTitle());
        doc.setContent(request.getContent());
        doc.setCategoryId(request.getCategoryId());
        doc.setAuthorId(authorId);
        doc.setStatus(DocumentStatus.DRAFT);
        doc.setAccessLevel(request.getAccessLevel());
        doc.setAllowComments(request.getAllowComments() != null ? request.getAllowComments() : true);
        if (request.getTagIds() != null) {
            Set<Tag> tags = new HashSet<>(tagRepository.findAllById(request.getTagIds()));
            doc.setTags(tags);
        }
        Document saved = documentRepository.save(doc);
        return toDTO(saved);
    }

    public DocumentDTO updateDocument(String id, DocumentUpdateRequest request) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found: " + id));
        if (request.getTitle() != null) {
            doc.setTitle(request.getTitle());
        }
        if (request.getContent() != null) {
            doc.setContent(request.getContent());
        }
        if (request.getCategoryId() != null) {
            doc.setCategoryId(request.getCategoryId());
        }
        if (request.getAccessLevel() != null) {
            doc.setAccessLevel(request.getAccessLevel());
        }
        if (request.getAllowComments() != null) {
            doc.setAllowComments(request.getAllowComments());
        }
        if (request.getTagIds() != null) {
            Set<Tag> tags = new HashSet<>(tagRepository.findAllById(request.getTagIds()));
            doc.setTags(tags);
        }
        Document saved = documentRepository.save(doc);
        return toDTO(saved);
    }

    public void deleteDocument(String id) {
        documentRepository.deleteById(id);
    }

    public void submitForReview(String documentId) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));
        if (doc.getStatus() != DocumentStatus.DRAFT && doc.getStatus() != DocumentStatus.REJECTED) {
            throw new RuntimeException("Document must be in DRAFT or REJECTED status to submit for review");
        }
        doc.setStatus(DocumentStatus.PENDING_REVIEW);
        documentRepository.save(doc);
        reviewConfigRepository.findByCategoryId(doc.getCategoryId()).ifPresent(config -> {
            if (config.getEnabled()) {
                ReviewRecord record1 = new ReviewRecord();
                record1.setDocumentId(documentId);
                record1.setLevel(1);
                record1.setStatus(ReviewStatus.PENDING);
                reviewRecordRepository.save(record1);
                if (config.getReviewLevels() >= 2) {
                    ReviewRecord record2 = new ReviewRecord();
                    record2.setDocumentId(documentId);
                    record2.setLevel(2);
                    record2.setStatus(ReviewStatus.PENDING);
                    reviewRecordRepository.save(record2);
                }
            }
        });
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentDTO> getPendingReviewDocuments(String reviewerId, int level, int page, int pageSize) {
        PageRequest pageable = PageRequest.of(page - 1, pageSize);
        Page<ReviewRecord> records = reviewRecordRepository
                .findByReviewerIdAndLevelAndStatus(reviewerId, level, ReviewStatus.PENDING, pageable);
        List<DocumentDTO> items = records.getContent().stream()
                .map(record -> documentRepository.findById(record.getDocumentId()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(this::toDTO)
                .collect(Collectors.toList());
        return new PageResponse<>(items, records.getTotalElements(), page, pageSize, records.getTotalPages());
    }

    @Transactional(readOnly = true)
    public List<DocumentDTO> getDocumentsByTagId(String tagId) {
        return documentRepository.findAll().stream()
                .filter(doc -> doc.getTags().stream().anyMatch(tag -> tagId.equals(tag.getId())))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private Specification<Document> buildSpecification(DocumentFilterRequest filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (filter.getKeyword() != null && !filter.getKeyword().isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + filter.getKeyword().toLowerCase() + "%"));
            }
            if (filter.getCategoryId() != null) {
                predicates.add(cb.equal(root.get("categoryId"), filter.getCategoryId()));
            }
            if (filter.getAuthorId() != null) {
                predicates.add(cb.equal(root.get("authorId"), filter.getAuthorId()));
            }
            if (filter.getStatus() != null) {
                predicates.add(cb.equal(root.get("status"), filter.getStatus()));
            }
            if (filter.getAccessLevel() != null) {
                predicates.add(cb.equal(root.get("accessLevel"), filter.getAccessLevel()));
            }
            if (filter.getTagIds() != null && !filter.getTagIds().isEmpty()) {
                Join<Document, Tag> tagJoin = root.join("tags", JoinType.INNER);
                predicates.add(tagJoin.get("id").in(filter.getTagIds()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private DocumentDTO toDTO(Document doc) {
        DocumentDTO dto = new DocumentDTO();
        dto.setId(doc.getId());
        dto.setTitle(doc.getTitle());
        dto.setContent(doc.getContent());
        dto.setCategoryId(doc.getCategoryId());
        dto.setAuthorId(doc.getAuthorId());
        dto.setStatus(doc.getStatus());
        dto.setAccessLevel(doc.getAccessLevel());
        dto.setViewCount(doc.getViewCount());
        dto.setAllowComments(doc.getAllowComments());
        dto.setTags(doc.getTags().stream().map(this::toTagDTO).collect(Collectors.toList()));
        dto.setCreatedAt(doc.getCreatedAt());
        dto.setUpdatedAt(doc.getUpdatedAt());
        return dto;
    }

    private TagDTO toTagDTO(Tag tag) {
        TagDTO dto = new TagDTO();
        dto.setId(tag.getId());
        dto.setName(tag.getName());
        dto.setUsageCount(tag.getUsageCount());
        dto.setCreatedAt(tag.getCreatedAt());
        dto.setUpdatedAt(tag.getUpdatedAt());
        return dto;
    }
}
