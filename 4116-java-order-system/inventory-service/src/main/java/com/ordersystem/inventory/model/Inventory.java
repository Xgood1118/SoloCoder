package com.ordersystem.inventory.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.Version;
import com.baomidou.mybatisplus.annotation.TableName;
import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import lombok.Data;

@Data
@TableName("inventory")
public class Inventory {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long skuId;
    private Long warehouseId;
    private String warehouseName;
    private Integer availableQty;
    private Integer preoccupiedQty;
    private Integer totalQty;
    @Version
    private Integer version;

    public void preoccupy(int qty) {
        if (qty <= 0) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "预占数量必须大于0");
        }
        if (availableQty < qty) {
            throw new BizException(CommonErrorCode.INSUFFICIENT_STOCK);
        }
        availableQty -= qty;
        preoccupiedQty += qty;
    }

    public void release(int qty) {
        if (qty <= 0) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "释放数量必须大于0");
        }
        if (preoccupiedQty < qty) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "预占库存不足，无法释放");
        }
        preoccupiedQty -= qty;
        availableQty += qty;
    }

    public void confirm(int qty) {
        if (qty <= 0) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "确认数量必须大于0");
        }
        if (preoccupiedQty < qty) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "预占库存不足，无法确认");
        }
        preoccupiedQty -= qty;
        totalQty -= qty;
    }
}
