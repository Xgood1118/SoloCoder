package com.wms.service;

import com.wms.dto.StockInRequest;
import com.wms.dto.StockOutRequest;
import com.wms.entity.*;
import com.wms.repository.*;
import com.wms.security.SecurityUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class StockService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryBatchRepository batchRepository;

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private StockRecordRepository stockRecordRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SecurityUtil securityUtil;

    @Transactional
    public StockRecord stockIn(StockInRequest request) {
        securityUtil.checkWarehouseAccess(request.getWarehouseId());

        Long operatorId = securityUtil.getCurrentUserId();
        String operatorName = securityUtil.getCurrentUsername();
        User operator = userRepository.findById(operatorId).orElse(null);
        if (operator != null) {
            operatorName = operator.getRealName();
        }

        Product product = productRepository.findByCode(request.getProductCode())
                .orElseGet(() -> {
                    Product newProduct = new Product();
                    newProduct.setName(request.getProductName());
                    newProduct.setCode(request.getProductCode() != null ? request.getProductCode() :
                            "P" + System.currentTimeMillis());
                    newProduct.setUnit(request.getProductUnit() != null ? request.getProductUnit() : "个");
                    newProduct.setWarehouseId(request.getWarehouseId());
                    newProduct.setWarningThreshold(request.getWarningThreshold() != null ? request.getWarningThreshold() : 0);
                    return productRepository.save(newProduct);
                });

        InventoryBatch batch = batchRepository.findByBatchNoAndProductId(request.getBatchNo(), product.getId())
                .orElseGet(() -> {
                    InventoryBatch newBatch = new InventoryBatch();
                    newBatch.setBatchNo(request.getBatchNo());
                    newBatch.setProductId(product.getId());
                    newBatch.setWarehouseId(request.getWarehouseId());
                    newBatch.setProductionDate(request.getProductionDate());
                    newBatch.setExpiryDate(request.getExpiryDate());
                    newBatch.setSupplier(request.getSupplier());
                    newBatch.setTotalQuantity(0);
                    newBatch.setAvailableQuantity(0);
                    return newBatch;
                });

        batch.setTotalQuantity(batch.getTotalQuantity() + request.getQuantity());
        batch.setAvailableQuantity(batch.getAvailableQuantity() + request.getQuantity());
        batch.setRemark(request.getRemark());
        batchRepository.save(batch);

        Inventory inventory = inventoryRepository.findByProductIdAndWarehouseId(product.getId(), request.getWarehouseId())
                .orElseGet(() -> {
                    Inventory newInventory = new Inventory();
                    newInventory.setProductId(product.getId());
                    newInventory.setWarehouseId(request.getWarehouseId());
                    newInventory.setTotalQuantity(0);
                    return newInventory;
                });

        inventory.setTotalQuantity(inventory.getTotalQuantity() + request.getQuantity());
        LocalDateTime inTime = request.getInTime() != null ? request.getInTime() : LocalDateTime.now();
        inventory.setLastInTime(inTime);
        inventoryRepository.save(inventory);

        StockRecord record = new StockRecord();
        record.setRecordNo(generateRecordNo("IN"));
        record.setType("IN");
        record.setProductId(product.getId());
        record.setBatchId(batch.getId());
        record.setWarehouseId(request.getWarehouseId());
        record.setQuantity(request.getQuantity());
        record.setOperatorId(operatorId);
        record.setOperatorName(operatorName);
        record.setSupplier(request.getSupplier());
        record.setOperationTime(inTime);
        record.setRemark(request.getRemark());

        return stockRecordRepository.save(record);
    }

    @Transactional
    public StockRecord stockOut(StockOutRequest request) {
        securityUtil.checkWarehouseAccess(request.getWarehouseId());

        Inventory inventory = inventoryRepository.findByProductIdAndWarehouseId(
                        request.getProductId(), request.getWarehouseId())
                .orElseThrow(() -> new RuntimeException("该商品在指定仓库不存在库存记录"));

        if (inventory.getTotalQuantity() < request.getQuantity()) {
            throw new RuntimeException("库存不足，当前库存: " + inventory.getTotalQuantity() + ", 需要出库: " + request.getQuantity());
        }

        List<InventoryBatch> availableBatches = batchRepository
                .findAvailableBatchesByProductAndWarehouseOrderByCreatedAtAsc(
                        request.getProductId(), request.getWarehouseId());

        if (availableBatches.isEmpty()) {
            throw new RuntimeException("无可用批次库存");
        }

        int remainingQuantity = request.getQuantity();
        InventoryBatch usedBatch = null;

        for (InventoryBatch batch : availableBatches) {
            if (remainingQuantity <= 0) break;

            int takeFromBatch = Math.min(batch.getAvailableQuantity(), remainingQuantity);
            batch.setAvailableQuantity(batch.getAvailableQuantity() - takeFromBatch);
            batchRepository.save(batch);

            if (usedBatch == null) {
                usedBatch = batch;
            }

            remainingQuantity -= takeFromBatch;
        }

        if (remainingQuantity > 0) {
            throw new RuntimeException("批次库存不足");
        }

        inventory.setTotalQuantity(inventory.getTotalQuantity() - request.getQuantity());
        LocalDateTime outTime = request.getOutTime() != null ? request.getOutTime() : LocalDateTime.now();
        inventory.setLastOutTime(outTime);
        inventoryRepository.save(inventory);

        Long operatorId = securityUtil.getCurrentUserId();
        String operatorName = securityUtil.getCurrentUsername();
        User operator = userRepository.findById(operatorId).orElse(null);
        if (operator != null) {
            operatorName = operator.getRealName();
        }

        StockRecord record = new StockRecord();
        record.setRecordNo(generateRecordNo("OUT"));
        record.setType("OUT");
        record.setProductId(request.getProductId());
        record.setBatchId(usedBatch.getId());
        record.setWarehouseId(request.getWarehouseId());
        record.setQuantity(request.getQuantity());
        record.setOperatorId(operatorId);
        record.setOperatorName(operatorName);
        record.setDepartment(request.getDepartment());
        record.setReceiver(request.getReceiver());
        record.setOperationTime(outTime);
        record.setRemark(request.getRemark());

        return stockRecordRepository.save(record);
    }

    private String generateRecordNo(String type) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return type + timestamp + uuid;
    }
}
