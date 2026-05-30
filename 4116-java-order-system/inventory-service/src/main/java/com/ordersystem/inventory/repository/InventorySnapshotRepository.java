package com.ordersystem.inventory.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.inventory.model.InventorySnapshot;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

public interface InventorySnapshotRepository extends BaseMapper<InventorySnapshot> {

    int save(InventorySnapshot snapshot);

    List<InventorySnapshot> findBySnapshotDate(@Param("snapshotDate") LocalDate snapshotDate);

    List<InventorySnapshot> findBySkuIdAndSnapshotDate(@Param("skuId") Long skuId, @Param("snapshotDate") LocalDate snapshotDate);
}
