package com.cms.service;

import com.cms.dto.CategoryDTO;
import com.cms.entity.Category;
import com.cms.entity.Document;
import com.cms.repository.CategoryRepository;
import com.cms.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final DocumentRepository documentRepository;

    public List<CategoryDTO> getCategoryTree() {
        List<Category> all = categoryRepository.findAll();
        return buildTree(all);
    }

    public CategoryDTO getCategoryById(String id) {
        Category cat = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found: " + id));
        return toDTO(cat);
    }

    public CategoryDTO createCategory(Category category) {
        validateMaxDepth(category.getParentId(), null);
        Category saved = categoryRepository.save(category);
        return toDTO(saved);
    }

    public CategoryDTO updateCategory(String id, Category category) {
        Category existing = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found: " + id));
        if (category.getName() != null) {
            existing.setName(category.getName());
        }
        if (category.getParentId() != null) {
            validateMaxDepth(category.getParentId(), id);
            existing.setParentId(category.getParentId());
        }
        if (category.getSortOrder() != null) {
            existing.setSortOrder(category.getSortOrder());
        }
        if (category.getDescription() != null) {
            existing.setDescription(category.getDescription());
        }
        Category saved = categoryRepository.save(existing);
        return toDTO(saved);
    }

    public void deleteCategory(String id, boolean moveDocumentsToRoot) {
        List<Category> children = categoryRepository.findByParentId(id);
        if (!children.isEmpty()) {
            throw new RuntimeException("Cannot delete category with child categories");
        }
        List<Document> docs = documentRepository.findAll().stream()
                .filter(d -> id.equals(d.getCategoryId()))
                .collect(Collectors.toList());
        if (moveDocumentsToRoot) {
            for (Document doc : docs) {
                doc.setCategoryId(null);
                documentRepository.save(doc);
            }
        } else {
            documentRepository.deleteAll(docs);
        }
        categoryRepository.deleteById(id);
    }

    public void moveCategory(String id, String newParentId) {
        Category cat = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found: " + id));
        validateMaxDepth(newParentId, id);
        cat.setParentId(newParentId);
        categoryRepository.save(cat);
    }

    public void updateDocumentCount(String categoryId) {
        long count = documentRepository.findAll().stream()
                .filter(d -> categoryId.equals(d.getCategoryId()))
                .count();
        Category cat = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new RuntimeException("Category not found: " + categoryId));
        cat.setDocumentCount((int) count);
        categoryRepository.save(cat);
    }

    private void validateMaxDepth(String parentId, String excludeId) {
        if (parentId == null) {
            return;
        }
        int depth = 1;
        String currentId = parentId;
        while (currentId != null) {
            if (currentId.equals(excludeId)) {
                throw new RuntimeException("Circular reference detected in category hierarchy");
            }
            depth++;
            if (depth > 3) {
                throw new RuntimeException("Category hierarchy cannot exceed 3 levels");
            }
            Category parent = categoryRepository.findById(currentId).orElse(null);
            if (parent == null) {
                break;
            }
            currentId = parent.getParentId();
        }
    }

    private List<CategoryDTO> buildTree(List<Category> categories) {
        Map<String, CategoryDTO> dtoMap = new LinkedHashMap<>();
        for (Category cat : categories) {
            dtoMap.put(cat.getId(), toDTO(cat));
        }
        List<CategoryDTO> roots = new ArrayList<>();
        for (Category cat : categories) {
            CategoryDTO dto = dtoMap.get(cat.getId());
            if (cat.getParentId() == null || !dtoMap.containsKey(cat.getParentId())) {
                roots.add(dto);
            } else {
                dtoMap.get(cat.getParentId()).getChildren().add(dto);
            }
        }
        return roots;
    }

    private CategoryDTO toDTO(Category cat) {
        CategoryDTO dto = new CategoryDTO();
        dto.setId(cat.getId());
        dto.setName(cat.getName());
        dto.setParentId(cat.getParentId());
        dto.setSortOrder(cat.getSortOrder());
        dto.setDocumentCount(cat.getDocumentCount());
        dto.setDescription(cat.getDescription());
        dto.setCreatedAt(cat.getCreatedAt());
        dto.setUpdatedAt(cat.getUpdatedAt());
        return dto;
    }
}
