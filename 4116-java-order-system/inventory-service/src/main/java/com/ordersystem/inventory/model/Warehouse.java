package com.ordersystem.inventory.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("warehouse")
public class Warehouse {

    @TableId(type = IdType.ASSIGN_ID)
    private Long warehouseId;
    private String warehouseName;
    private String province;
    private String city;
    private String district;
    private Boolean enabled;
}
