package com.cms.service;

import com.cms.dto.DocumentTemplateDTO;
import com.cms.dto.TemplateCreateRequest;
import com.cms.dto.TemplateUpdateRequest;
import com.cms.entity.DocumentTemplate;
import com.cms.repository.DocumentTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentTemplateService {

    private final DocumentTemplateRepository documentTemplateRepository;

    public List<DocumentTemplateDTO> getAllTemplates() {
        return documentTemplateRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<DocumentTemplateDTO> getTemplatesByCategory(String categoryId) {
        Set<DocumentTemplate> templates = new HashSet<>();
        templates.addAll(documentTemplateRepository.findByCategoryId(categoryId));
        templates.addAll(documentTemplateRepository.findByIsDefaultTrue());
        return templates.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public DocumentTemplateDTO getTemplateById(String id) {
        DocumentTemplate template = documentTemplateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));
        return toDTO(template);
    }

    public DocumentTemplateDTO createTemplate(TemplateCreateRequest request, String userId) {
        DocumentTemplate template = new DocumentTemplate();
        template.setName(request.getName());
        template.setDescription(request.getDescription());
        template.setCategoryId(request.getCategoryId());
        template.setStructure(request.getStructure());
        template.setCreatedBy(userId);
        template.setIsDefault(request.getIsDefault() != null ? request.getIsDefault() : false);
        DocumentTemplate saved = documentTemplateRepository.save(template);
        return toDTO(saved);
    }

    public DocumentTemplateDTO updateTemplate(String id, TemplateUpdateRequest request) {
        DocumentTemplate template = documentTemplateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));
        if (request.getName() != null) {
            template.setName(request.getName());
        }
        if (request.getDescription() != null) {
            template.setDescription(request.getDescription());
        }
        if (request.getCategoryId() != null) {
            template.setCategoryId(request.getCategoryId());
        }
        if (request.getStructure() != null) {
            template.setStructure(request.getStructure());
        }
        if (request.getIsDefault() != null) {
            template.setIsDefault(request.getIsDefault());
        }
        DocumentTemplate saved = documentTemplateRepository.save(template);
        return toDTO(saved);
    }

    public void deleteTemplate(String id) {
        documentTemplateRepository.deleteById(id);
    }

    private DocumentTemplateDTO toDTO(DocumentTemplate template) {
        DocumentTemplateDTO dto = new DocumentTemplateDTO();
        dto.setId(template.getId());
        dto.setName(template.getName());
        dto.setDescription(template.getDescription());
        dto.setCategoryId(template.getCategoryId());
        dto.setStructure(template.getStructure());
        dto.setCreatedBy(template.getCreatedBy());
        dto.setIsDefault(template.getIsDefault());
        dto.setCreatedAt(template.getCreatedAt());
        dto.setUpdatedAt(template.getUpdatedAt());
        return dto;
    }
}
