package com.wms.repository;

import com.wms.entity.InventoryBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryBatchRepository extends JpaRepository<InventoryBatch, Long> {
    
    @Query("SELECT b FROM InventoryBatch b WHERE b.productId = :productId AND b.warehouseId = :warehouseId AND b.availableQuantity > 0 ORDER BY b.createdAt ASC")
    List<InventoryBatch> findAvailableBatchesByProductAndWarehouseOrderByCreatedAtAsc(
            @Param("productId") Long productId,
            @Param("warehouseId") Long warehouseId);
    
    @Query("SELECT b FROM InventoryBatch b WHERE b.batchNo = :batchNo AND b.productId = :productId")
    Optional<InventoryBatch> findByBatchNoAndProductId(
            @Param("batchNo") String batchNo,
            @Param("productId") Long productId);
    
    @Query("SELECT b FROM InventoryBatch b WHERE b.batchNo = :batchNo")
    List<InventoryBatch> findByBatchNo(@Param("batchNo") String batchNo);
    
    List<InventoryBatch> findByProductId(Long productId);
    
    @Query("SELECT b FROM InventoryBatch b WHERE b.warehouseId = :warehouseId")
    List<InventoryBatch> findByWarehouseId(@Param("warehouseId") Long warehouseId);
}
