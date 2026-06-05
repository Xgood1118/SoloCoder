package com.wms.service;

import com.wms.entity.InventoryBatch;
import com.wms.entity.StockRecord;
import com.wms.repository.InventoryBatchRepository;
import com.wms.repository.StockRecordRepository;
import com.wms.security.SecurityUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class BatchService {

    @Autowired
    private InventoryBatchRepository batchRepository;

    @Autowired
    private StockRecordRepository stockRecordRepository;

    @Autowired
    private SecurityUtil securityUtil;

    public List<InventoryBatch> getBatchesByProductId(Long productId) {
        return batchRepository.findByProductId(productId);
    }

    public Map<String, Object> getBatchRecordsByBatchNo(String batchNo) {
        List<InventoryBatch> batches = batchRepository.findByBatchNo(batchNo);
        if (batches.isEmpty()) {
            throw new RuntimeException("批次号不存在");
        }

        for (InventoryBatch batch : batches) {
            securityUtil.checkWarehouseAccess(batch.getWarehouseId());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("batches", batches);

        List<StockRecord> records = batches.stream()
                .flatMap(batch -> stockRecordRepository.findByBatchIdAndWarehouseId(
                                batch.getId(), batch.getWarehouseId())
                        .stream())
                .collect(java.util.stream.Collectors.toList());
        result.put("records", records);

        return result;
    }

    public Page<InventoryBatch> getBatchList(Long warehouseId, Pageable pageable) {
        Long userWarehouseId = securityUtil.getCurrentUserWarehouseId();
        boolean isAdmin = securityUtil.isCurrentUserAdmin();

        if (!isAdmin && userWarehouseId != null) {
            warehouseId = userWarehouseId;
        }

        if (warehouseId != null) {
            securityUtil.checkWarehouseAccess(warehouseId);
            List<InventoryBatch> batches = batchRepository.findByWarehouseId(warehouseId);
            return batches.stream()
                    .skip((long) pageable.getPageNumber() * pageable.getPageSize())
                    .limit(pageable.getPageSize())
                    .collect(java.util.stream.Collectors.collectingAndThen(
                            java.util.stream.Collectors.toList(),
                            list -> new org.springframework.data.domain.PageImpl<>(list, pageable, batches.size())
                    ));
        }

        return batchRepository.findAll(pageable);
    }
}
