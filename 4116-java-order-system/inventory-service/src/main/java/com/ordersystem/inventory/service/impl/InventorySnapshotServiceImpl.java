package com.ordersystem.inventory.service.impl;

import com.ordersystem.common.lock.DistributedLockAnnotation;
import com.ordersystem.inventory.model.Inventory;
import com.ordersystem.inventory.model.InventorySnapshot;
import com.ordersystem.inventory.repository.InventoryRepository;
import com.ordersystem.inventory.repository.InventorySnapshotRepository;
import com.ordersystem.inventory.service.InventorySnapshotService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InventorySnapshotServiceImpl implements InventorySnapshotService {

    private final InventoryRepository inventoryRepository;
    private final InventorySnapshotRepository inventorySnapshotRepository;

    @Override
    @Scheduled(cron = "0 0 2 * * ?")
    @DistributedLockAnnotation(key = "'inventory:snapshot:daily'", waitTime = 0, leaseTime = 300)
    public List<InventorySnapshot> generateDailySnapshot() {
        LocalDate today = LocalDate.now();
        List<Inventory> allInventory = inventoryRepository.selectList(null);
        List<InventorySnapshot> snapshots = new ArrayList<>();
        for (Inventory inv : allInventory) {
            InventorySnapshot snapshot = new InventorySnapshot();
            snapshot.setSkuId(inv.getSkuId());
            snapshot.setWarehouseId(inv.getWarehouseId());
            snapshot.setAvailableQty(inv.getAvailableQty());
            snapshot.setPreoccupiedQty(inv.getPreoccupiedQty());
            snapshot.setTotalQty(inv.getTotalQty());
            snapshot.setSnapshotDate(today);
            snapshot.setCreatedAt(LocalDateTime.now());
            inventorySnapshotRepository.save(snapshot);
            snapshots.add(snapshot);
        }
        return snapshots;
    }
}
