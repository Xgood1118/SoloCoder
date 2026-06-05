package com.wms.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class InventoryDTO {
    private Long id;
    private Long productId;
    private String productName;
    private String productCode;
    private String category;
    private String unit;
    private Long warehouseId;
    private String warehouseName;
    private Integer totalQuantity;
    private Integer warningThreshold;
    private LocalDateTime lastInTime;
    private LocalDateTime lastOutTime;
    private LocalDateTime updatedAt;
}
