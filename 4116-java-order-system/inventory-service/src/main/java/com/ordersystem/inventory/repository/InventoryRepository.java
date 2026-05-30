package com.ordersystem.inventory.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.inventory.model.Inventory;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.util.List;

public interface InventoryRepository extends BaseMapper<Inventory> {

    Inventory findBySkuIdAndWarehouseId(@Param("skuId") Long skuId, @Param("warehouseId") Long warehouseId);

    List<Inventory> findBySkuId(@Param("skuId") Long skuId);

    @Update("UPDATE inventory SET available_qty = available_qty - #{qty}, preoccupied_qty = preoccupied_qty + #{qty}, version = version + 1 " +
            "WHERE sku_id = #{skuId} AND warehouse_id = #{warehouseId} AND available_qty >= #{qty} AND version = #{version}")
    int updateWithVersion(@Param("skuId") Long skuId, @Param("warehouseId") Long warehouseId,
                          @Param("qty") int qty, @Param("version") int version);

    int batchSave(@Param("list") List<Inventory> list);
}
