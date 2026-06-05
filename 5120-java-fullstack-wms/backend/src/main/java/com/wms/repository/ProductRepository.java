package com.wms.repository;

import com.wms.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findByCode(String code);
    
    @Query("SELECT p FROM Product p WHERE p.name LIKE CONCAT('%', :name, '%')")
    List<Product> findByNameContaining(@Param("name") String name);
    
    @Query("SELECT p FROM Product p WHERE p.warehouseId = :warehouseId AND p.name LIKE CONCAT('%', :name, '%')")
    Page<Product> findByWarehouseIdAndNameContaining(
            @Param("warehouseId") Long warehouseId,
            @Param("name") String name,
            Pageable pageable);
    
    @Query("SELECT p FROM Product p WHERE p.name LIKE CONCAT('%', :name, '%')")
    Page<Product> findByNameContainingPage(@Param("name") String name, Pageable pageable);
    
    Page<Product> findByWarehouseId(Long warehouseId, Pageable pageable);
    boolean existsByCode(String code);
}
