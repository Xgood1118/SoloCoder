package com.cms.repository;

import com.cms.entity.DocumentTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentTemplateRepository extends JpaRepository<DocumentTemplate, String> {

    List<DocumentTemplate> findByCategoryId(String categoryId);

    List<DocumentTemplate> findByIsDefaultTrue();
}
