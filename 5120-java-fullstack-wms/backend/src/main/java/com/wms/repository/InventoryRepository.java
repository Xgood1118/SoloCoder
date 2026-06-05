package com.wms.repository;

import com.wms.entity.Inventory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, Long> {
    
    Optional<Inventory> findByProductIdAndWarehouseId(Long productId, Long warehouseId);
    
    @Query("SELECT i FROM Inventory i JOIN Product p ON i.productId = p.id " +
           "WHERE i.warehouseId = :warehouseId AND p.name LIKE CONCAT('%', :productName, '%')")
    Page<Inventory> findByWarehouseIdAndProductNameContaining(
            @Param("warehouseId") Long warehouseId,
            @Param("productName") String productName,
            Pageable pageable);
    
    @Query("SELECT i FROM Inventory i JOIN Product p ON i.productId = p.id " +
           "WHERE p.name LIKE CONCAT('%', :productName, '%')")
    Page<Inventory> findByProductNameContaining(
            @Param("productName") String productName,
            Pageable pageable);
    
    List<Inventory> findByWarehouseId(Long warehouseId);
    
    @Query("SELECT i FROM Inventory i WHERE i.totalQuantity <= (SELECT p.warningThreshold FROM Product p WHERE p.id = i.productId)")
    List<Inventory> findLowStockItems();
}
