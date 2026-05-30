package com.ordersystem.inventory.service;

import com.ordersystem.inventory.model.Inventory;

import java.util.List;

public interface InventoryService {

    Inventory preoccupy(Long skuId, int qty, Long warehouseId);

    Inventory release(Long skuId, int qty, Long warehouseId);

    Inventory confirm(Long skuId, int qty, Long warehouseId);

    List<Inventory> getStock(Long skuId);

    WarehouseAllocation allocateWarehouse(Long skuId, int qty, String address);

    record WarehouseAllocation(Long warehouseId, String warehouseName) {}
}
