package com.wms.repository;

import com.wms.entity.StockRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StockRecordRepository extends JpaRepository<StockRecord, Long> {
    
    Page<StockRecord> findByType(String type, Pageable pageable);
    
    Page<StockRecord> findByProductId(Long productId, Pageable pageable);
    
    Page<StockRecord> findByBatchId(Long batchId, Pageable pageable);
    
    Page<StockRecord> findByWarehouseId(Long warehouseId, Pageable pageable);
    
    @Query("SELECT s FROM StockRecord s WHERE s.batchId = :batchId AND s.warehouseId = :warehouseId")
    List<StockRecord> findByBatchIdAndWarehouseId(
            @Param("batchId") Long batchId,
            @Param("warehouseId") Long warehouseId);
    
    @Query("SELECT s FROM StockRecord s WHERE s.operationTime BETWEEN :startTime AND :endTime")
    Page<StockRecord> findByOperationTimeBetween(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);
    
    @Query("SELECT s FROM StockRecord s WHERE s.warehouseId = :warehouseId " +
           "AND s.operationTime BETWEEN :startTime AND :endTime")
    List<StockRecord> findByWarehouseIdAndOperationTimeBetweenForExport(
            @Param("warehouseId") Long warehouseId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);
    
    @Query("SELECT s FROM StockRecord s WHERE s.operationTime BETWEEN :startTime AND :endTime")
    List<StockRecord> findByOperationTimeBetweenForExport(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);
}
