package com.ordersystem.inventory.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.inventory.model.InventoryAlert;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface InventoryAlertRepository extends BaseMapper<InventoryAlert> {

    int save(InventoryAlert alert);

    List<InventoryAlert> findUnresolved();

    List<InventoryAlert> findBySkuId(@Param("skuId") Long skuId);
}
