package com.ordersystem.inventory.service.impl;

import com.ordersystem.common.event.DomainEvent;
import com.ordersystem.common.event.EventPublisher;
import com.ordersystem.inventory.model.AlertLevel;
import com.ordersystem.inventory.model.Inventory;
import com.ordersystem.inventory.model.InventoryAlert;
import com.ordersystem.inventory.repository.InventoryAlertRepository;
import com.ordersystem.inventory.repository.InventoryRepository;
import com.ordersystem.inventory.service.InventoryAlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class InventoryAlertServiceImpl implements InventoryAlertService {

    private static final int WARN_THRESHOLD = 50;
    private static final int URGENT_THRESHOLD = 10;

    private final InventoryAlertRepository inventoryAlertRepository;
    private final InventoryRepository inventoryRepository;
    private final EventPublisher eventPublisher;

    @Override
    public InventoryAlert checkAndAlert(Long skuId, Long warehouseId) {
        Inventory inventory = inventoryRepository.findBySkuIdAndWarehouseId(skuId, warehouseId);
        if (inventory == null) {
            return null;
        }
        int currentQty = inventory.getAvailableQty();
        AlertLevel level = determineLevel(currentQty);
        if (level == null) {
            return null;
        }
        int threshold = level == AlertLevel.URGENT ? URGENT_THRESHOLD : WARN_THRESHOLD;
        InventoryAlert alert = new InventoryAlert();
        alert.setSkuId(skuId);
        alert.setWarehouseId(warehouseId);
        alert.setThreshold(threshold);
        alert.setCurrentQty(currentQty);
        alert.setAlertLevel(level);
        alert.setCreatedAt(LocalDateTime.now());
        inventoryAlertRepository.save(alert);
        eventPublisher.publish(new InventoryAlertEvent(skuId, warehouseId, currentQty, level));
        return alert;
    }

    private AlertLevel determineLevel(int currentQty) {
        if (currentQty <= URGENT_THRESHOLD) {
            return AlertLevel.URGENT;
        }
        if (currentQty <= WARN_THRESHOLD) {
            return AlertLevel.WARN;
        }
        return null;
    }

    public static class InventoryAlertEvent extends DomainEvent {

        private final Long skuId;
        private final Long warehouseId;
        private final int currentQty;
        private final AlertLevel alertLevel;

        public InventoryAlertEvent(Long skuId, Long warehouseId, int currentQty, AlertLevel alertLevel) {
            super("INV_ALERT_" + skuId + "_" + warehouseId, "INVENTORY_ALERT");
            this.skuId = skuId;
            this.warehouseId = warehouseId;
            this.currentQty = currentQty;
            this.alertLevel = alertLevel;
        }

        public Long getSkuId() {
            return skuId;
        }

        public Long getWarehouseId() {
            return warehouseId;
        }

        public int getCurrentQty() {
            return currentQty;
        }

        public AlertLevel getAlertLevel() {
            return alertLevel;
        }
    }
}
