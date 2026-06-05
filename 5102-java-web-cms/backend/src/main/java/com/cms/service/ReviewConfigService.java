package com.cms.service;

import com.cms.dto.ReviewConfigCreateRequest;
import com.cms.dto.ReviewConfigDTO;
import com.cms.dto.ReviewConfigUpdateRequest;
import com.cms.entity.ReviewConfig;
import com.cms.repository.ReviewConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewConfigService {

    private final ReviewConfigRepository reviewConfigRepository;

    public List<ReviewConfigDTO> getAllConfigs() {
        return reviewConfigRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public ReviewConfigDTO getConfigByCategory(String categoryId) {
        ReviewConfig config = reviewConfigRepository.findByCategoryId(categoryId)
                .orElseThrow(() -> new RuntimeException("Review config not found for category: " + categoryId));
        return toDTO(config);
    }

    public ReviewConfigDTO createConfig(ReviewConfigCreateRequest request) {
        ReviewConfig config = new ReviewConfig();
        config.setCategoryId(request.getCategoryId());
        config.setReviewLevels(request.getReviewLevels());
        config.setLevel1ReviewerRole(request.getLevel1ReviewerRole());
        config.setLevel2ReviewerRole(request.getLevel2ReviewerRole());
        config.setEnabled(request.getEnabled() != null ? request.getEnabled() : true);
        ReviewConfig saved = reviewConfigRepository.save(config);
        return toDTO(saved);
    }

    public ReviewConfigDTO updateConfig(String id, ReviewConfigUpdateRequest request) {
        ReviewConfig config = reviewConfigRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Review config not found: " + id));
        if (request.getReviewLevels() != null) {
            config.setReviewLevels(request.getReviewLevels());
        }
        if (request.getLevel1ReviewerRole() != null) {
            config.setLevel1ReviewerRole(request.getLevel1ReviewerRole());
        }
        if (request.getLevel2ReviewerRole() != null) {
            config.setLevel2ReviewerRole(request.getLevel2ReviewerRole());
        }
        if (request.getEnabled() != null) {
            config.setEnabled(request.getEnabled());
        }
        ReviewConfig saved = reviewConfigRepository.save(config);
        return toDTO(saved);
    }

    public void deleteConfig(String id) {
        reviewConfigRepository.deleteById(id);
    }

    private ReviewConfigDTO toDTO(ReviewConfig config) {
        ReviewConfigDTO dto = new ReviewConfigDTO();
        dto.setId(config.getId());
        dto.setCategoryId(config.getCategoryId());
        dto.setReviewLevels(config.getReviewLevels());
        dto.setLevel1ReviewerRole(config.getLevel1ReviewerRole());
        dto.setLevel2ReviewerRole(config.getLevel2ReviewerRole());
        dto.setEnabled(config.getEnabled());
        dto.setCreatedAt(config.getCreatedAt());
        dto.setUpdatedAt(config.getUpdatedAt());
        return dto;
    }
}
