package com.ecommerce.inventory.service;

import com.ecommerce.inventory.entity.Inventory;
import com.ecommerce.inventory.lock.StockLockProvider;
import com.ecommerce.inventory.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final StockLockProvider stockLockProvider;

    private static final String STOCK_LOCK_PREFIX = "stock:lock:";
    private static final long LOCK_TIMEOUT_SECONDS = 10;

    @Transactional
    public Inventory initInventory(Long skuId, Integer totalStock) {
        if (inventoryRepository.findBySkuId(skuId).isPresent()) {
            throw new IllegalStateException("Inventory already exists for SKU: " + skuId);
        }

        Inventory inventory = new Inventory();
        inventory.setSkuId(skuId);
        inventory.setTotalStock(totalStock);
        inventory.setLockedStock(0);
        inventory.setAvailableStock(totalStock);
        return inventoryRepository.save(inventory);
    }

    @Transactional
    public void lockStockWithDistributedLock(Long skuId, Integer quantity) {
        String lockKey = STOCK_LOCK_PREFIX + skuId;

        boolean locked = false;
        try {
            locked = stockLockProvider.tryLock(lockKey, LOCK_TIMEOUT_SECONDS);

            if (!locked) {
                throw new IllegalStateException("Failed to acquire stock lock for SKU: " + skuId + ". Another transaction is in progress.");
            }

            int updated = inventoryRepository.lockStock(skuId, quantity);
            if (updated == 0) {
                throw new IllegalStateException("Insufficient available stock for SKU: " + skuId + ". Quantity requested: " + quantity);
            }

            log.info("Stock locked: skuId={}, quantity={}", skuId, quantity);
        } finally {
            if (locked) {
                stockLockProvider.unlock(lockKey);
            }
        }
    }

    @Transactional
    public void deductStock(Long skuId, Integer quantity) {
        int updated = inventoryRepository.deductStock(skuId, quantity);
        if (updated == 0) {
            throw new IllegalStateException("Failed to deduct stock for SKU: " + skuId + ". Insufficient locked stock.");
        }
        log.info("Stock deducted: skuId={}, quantity={}", skuId, quantity);
    }

    @Transactional
    public void rollbackStock(Long skuId, Integer quantity) {
        int updated = inventoryRepository.rollbackStock(skuId, quantity);
        if (updated == 0) {
            throw new IllegalStateException("Failed to rollback stock for SKU: " + skuId + ". Insufficient locked stock.");
        }
        log.info("Stock rolled back: skuId={}, quantity={}", skuId, quantity);
    }

    @Transactional
    public void returnStock(Long skuId, Integer quantity) {
        int updated = inventoryRepository.returnStock(skuId, quantity);
        if (updated == 0) {
            throw new IllegalStateException("Failed to return stock for SKU: " + skuId);
        }
        log.info("Stock returned: skuId={}, quantity={}", skuId, quantity);
    }

    public Inventory getInventory(Long skuId) {
        return inventoryRepository.findBySkuId(skuId)
                .orElseThrow(() -> new IllegalArgumentException("Inventory not found for SKU: " + skuId));
    }

    public List<Inventory> listAllInventory() {
        return inventoryRepository.findAll();
    }

    @Transactional
    public Inventory adjustStock(Long skuId, Integer newTotalStock) {
        Inventory inventory = inventoryRepository.findBySkuId(skuId)
                .orElseThrow(() -> new IllegalArgumentException("Inventory not found for SKU: " + skuId));
        inventory.setStock(newTotalStock);
        return inventoryRepository.save(inventory);
    }
}
