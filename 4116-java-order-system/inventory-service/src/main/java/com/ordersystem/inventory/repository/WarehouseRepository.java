package com.ordersystem.inventory.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.inventory.model.Warehouse;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface WarehouseRepository extends BaseMapper<Warehouse> {

    Warehouse findById(@Param("warehouseId") Long warehouseId);

    List<Warehouse> findByProvinceAndCity(@Param("province") String province, @Param("city") String city);

    List<Warehouse> findAll();
}
