package com.ecommerce.product.repository;

import com.ecommerce.product.entity.TieredPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TieredPriceRepository extends JpaRepository<TieredPrice, Long> {

    List<TieredPrice> findBySkuIdOrderByMinQuantityAsc(Long skuId);
}
