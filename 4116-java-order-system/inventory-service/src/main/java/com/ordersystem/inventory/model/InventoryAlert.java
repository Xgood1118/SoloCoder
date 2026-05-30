package com.ordersystem.inventory.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("inventory_alert")
public class InventoryAlert {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long skuId;
    private Long warehouseId;
    private Integer threshold;
    private Integer currentQty;
    private AlertLevel alertLevel;
    private LocalDateTime createdAt;
}
