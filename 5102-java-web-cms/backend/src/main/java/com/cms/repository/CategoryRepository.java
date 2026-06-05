package com.cms.repository;

import com.cms.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, String> {

    List<Category> findByParentIdIsNull();

    List<Category> findByParentId(String parentId);
}
