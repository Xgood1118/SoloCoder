package com.ecommerce.promotion.repository;

import com.ecommerce.promotion.entity.Promotion;
import com.ecommerce.promotion.entity.PromotionType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {

    List<Promotion> findByActiveTrueOrderByPriorityAsc();

    List<Promotion> findByTypeAndActiveTrue(PromotionType type);
}
