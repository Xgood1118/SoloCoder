package com.ecommerce.product.repository;

import com.ecommerce.product.entity.Sku;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SkuRepository extends JpaRepository<Sku, Long> {

    List<Sku> findByProductId(Long productId);

    Optional<Sku> findBySkuCode(String skuCode);
}
