package com.cms.repository;

import com.cms.entity.ReviewConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReviewConfigRepository extends JpaRepository<ReviewConfig, String> {

    Optional<ReviewConfig> findByCategoryId(String categoryId);
}
