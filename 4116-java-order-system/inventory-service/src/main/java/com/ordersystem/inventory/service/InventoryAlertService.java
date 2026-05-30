package com.ordersystem.inventory.service;

import com.ordersystem.inventory.model.InventoryAlert;

public interface InventoryAlertService {

    InventoryAlert checkAndAlert(Long skuId, Long warehouseId);
}
