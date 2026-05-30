package com.ordersystem.inventory.service;

import com.ordersystem.inventory.model.InventorySnapshot;

import java.util.List;

public interface InventorySnapshotService {

    List<InventorySnapshot> generateDailySnapshot();
}
