package com.cms.service;

import com.cms.dto.PageResponse;
import com.cms.dto.TagDTO;
import com.cms.entity.Tag;
import com.cms.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TagService {

    private final TagRepository tagRepository;

    public PageResponse<TagDTO> getTags(String name, int page, int pageSize) {
        PageRequest pageable = PageRequest.of(page - 1, pageSize);
        Page<Tag> tagPage;
        if (name != null && !name.isBlank()) {
            tagPage = tagRepository.findByNameContaining(name, pageable);
        } else {
            tagPage = tagRepository.findAll(pageable);
        }
        List<TagDTO> items = tagPage.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return new PageResponse<>(items, tagPage.getTotalElements(), page, pageSize, tagPage.getTotalPages());
    }

    public TagDTO getTagById(String id) {
        Tag tag = tagRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tag not found: " + id));
        return toDTO(tag);
    }

    public TagDTO createTag(Tag tag) {
        Tag saved = tagRepository.save(tag);
        return toDTO(saved);
    }

    public TagDTO updateTag(String id, Tag tag) {
        Tag existing = tagRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tag not found: " + id));
        if (tag.getName() != null) {
            existing.setName(tag.getName());
        }
        if (tag.getUsageCount() != null) {
            existing.setUsageCount(tag.getUsageCount());
        }
        Tag saved = tagRepository.save(existing);
        return toDTO(saved);
    }

    public void deleteTag(String id) {
        tagRepository.deleteById(id);
    }

    public List<TagDTO> searchTags(String name) {
        return tagRepository.findByNameContaining(name).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private TagDTO toDTO(Tag tag) {
        TagDTO dto = new TagDTO();
        dto.setId(tag.getId());
        dto.setName(tag.getName());
        dto.setUsageCount(tag.getUsageCount());
        dto.setCreatedAt(tag.getCreatedAt());
        dto.setUpdatedAt(tag.getUpdatedAt());
        return dto;
    }
}
