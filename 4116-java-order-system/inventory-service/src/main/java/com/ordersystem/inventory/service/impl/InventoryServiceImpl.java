package com.ordersystem.inventory.service.impl;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.common.lock.DistributedLockAnnotation;
import com.ordersystem.inventory.model.Inventory;
import com.ordersystem.inventory.model.Warehouse;
import com.ordersystem.inventory.repository.InventoryRepository;
import com.ordersystem.inventory.repository.WarehouseRepository;
import com.ordersystem.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.redisson.api.RScript;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;
    private final WarehouseRepository warehouseRepository;
    private final RedissonClient redissonClient;

    private static final String DEDUCT_SCRIPT_SHA_KEY = "inventory:deduct:sha";
    private static final String RELEASE_SCRIPT_SHA_KEY = "inventory:release:sha";

    @Override
    @DistributedLockAnnotation(key = "'inventory:preoccupy:' + #skuId + ':' + #warehouseId")
    @Transactional
    public Inventory preoccupy(Long skuId, int qty, Long warehouseId) {
        String availableKey = "inventory:available:" + skuId + ":" + warehouseId;
        String preoccupiedKey = "inventory:preoccupied:" + skuId + ":" + warehouseId;
        String deductSha = redissonClient.getBucket(DEDUCT_SCRIPT_SHA_KEY).get().toString();
        Long result = redissonClient.getScript().evalSha(
                RScript.Mode.READ_WRITE,
                deductSha,
                RScript.ReturnType.INTEGER,
                Arrays.asList(availableKey, preoccupiedKey),
                qty
        );
        if (result == null || result == 0L) {
            throw new BizException(CommonErrorCode.INSUFFICIENT_STOCK);
        }
        Inventory inventory = inventoryRepository.findBySkuIdAndWarehouseId(skuId, warehouseId);
        if (inventory == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "库存记录不存在");
        }
        inventory.preoccupy(qty);
        int updated = inventoryRepository.updateWithVersion(skuId, warehouseId, qty, inventory.getVersion());
        if (updated == 0) {
            throw new BizException(CommonErrorCode.SYSTEM_ERROR, "库存更新冲突，请重试");
        }
        inventory.setVersion(inventory.getVersion() + 1);
        return inventory;
    }

    @Override
    @DistributedLockAnnotation(key = "'inventory:release:' + #skuId + ':' + #warehouseId")
    @Transactional
    public Inventory release(Long skuId, int qty, Long warehouseId) {
        String availableKey = "inventory:available:" + skuId + ":" + warehouseId;
        String preoccupiedKey = "inventory:preoccupied:" + skuId + ":" + warehouseId;
        String releaseSha = redissonClient.getBucket(RELEASE_SCRIPT_SHA_KEY).get().toString();
        redissonClient.getScript().evalSha(
                RScript.Mode.READ_WRITE,
                releaseSha,
                RScript.ReturnType.INTEGER,
                Arrays.asList(availableKey, preoccupiedKey),
                qty
        );
        Inventory inventory = inventoryRepository.findBySkuIdAndWarehouseId(skuId, warehouseId);
        if (inventory == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "库存记录不存在");
        }
        inventory.release(qty);
        int updated = inventoryRepository.updateById(inventory);
        if (updated == 0) {
            throw new BizException(CommonErrorCode.SYSTEM_ERROR, "库存更新冲突，请重试");
        }
        return inventory;
    }

    @Override
    @DistributedLockAnnotation(key = "'inventory:confirm:' + #skuId + ':' + #warehouseId")
    @Transactional
    public Inventory confirm(Long skuId, int qty, Long warehouseId) {
        Inventory inventory = inventoryRepository.findBySkuIdAndWarehouseId(skuId, warehouseId);
        if (inventory == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "库存记录不存在");
        }
        inventory.confirm(qty);
        int updated = inventoryRepository.updateById(inventory);
        if (updated == 0) {
            throw new BizException(CommonErrorCode.SYSTEM_ERROR, "库存更新冲突，请重试");
        }
        String preoccupiedKey = "inventory:preoccupied:" + skuId + ":" + warehouseId;
        redissonClient.getAtomicLong(preoccupiedKey).decrementAndGet();
        return inventory;
    }

    @Override
    public List<Inventory> getStock(Long skuId) {
        return inventoryRepository.findBySkuId(skuId);
    }

    @Override
    public WarehouseAllocation allocateWarehouse(Long skuId, int qty, String address) {
        String[] parts = address.split("/");
        String province = parts.length > 0 ? parts[0] : "";
        String city = parts.length > 1 ? parts[1] : "";
        String district = parts.length > 2 ? parts[2] : "";

        List<Warehouse> warehouses = warehouseRepository.findByProvinceAndCity(province, city);
        Warehouse matched = warehouses.stream()
                .filter(w -> Boolean.TRUE.equals(w.getEnabled()))
                .filter(w -> {
                    if (district != null && !district.isEmpty() && w.getDistrict() != null) {
                        return w.getDistrict().equals(district);
                    }
                    return true;
                })
                .findFirst()
                .orElse(null);

        if (matched == null) {
            matched = warehouses.stream()
                    .filter(w -> Boolean.TRUE.equals(w.getEnabled()))
                    .findFirst()
                    .orElse(null);
        }

        if (matched == null) {
            List<Warehouse> allWarehouses = warehouseRepository.findAll();
            matched = allWarehouses.stream()
                    .filter(w -> Boolean.TRUE.equals(w.getEnabled()))
                    .findFirst()
                    .orElseThrow(() -> new BizException(CommonErrorCode.NOT_FOUND, "没有可用仓库"));
        }

        Inventory inventory = inventoryRepository.findBySkuIdAndWarehouseId(skuId, matched.getWarehouseId());
        if (inventory == null || inventory.getAvailableQty() < qty) {
            throw new BizException(CommonErrorCode.INSUFFICIENT_STOCK, "仓库库存不足");
        }

        return new WarehouseAllocation(matched.getWarehouseId(), matched.getWarehouseName());
    }
}
