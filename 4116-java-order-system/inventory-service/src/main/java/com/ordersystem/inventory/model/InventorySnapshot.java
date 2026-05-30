package com.ordersystem.inventory.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("inventory_snapshot")
public class InventorySnapshot {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long skuId;
    private Long warehouseId;
    private Integer availableQty;
    private Integer preoccupiedQty;
    private Integer totalQty;
    private LocalDate snapshotDate;
    private LocalDateTime createdAt;
}
