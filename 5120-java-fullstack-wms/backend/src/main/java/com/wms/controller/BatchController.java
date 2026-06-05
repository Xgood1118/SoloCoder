package com.wms.controller;

import com.wms.dto.ApiResponse;
import com.wms.entity.InventoryBatch;
import com.wms.service.BatchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/batch")
public class BatchController {

    @Autowired
    private BatchService batchService;

    @GetMapping("/list")
    public ApiResponse<Page<InventoryBatch>> getBatchList(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            Page<InventoryBatch> result = batchService.getBatchList(warehouseId, pageable);
            return ApiResponse.success(result);
        } catch (SecurityException e) {
            return ApiResponse.error(403, e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/product/{productId}")
    public ApiResponse<List<InventoryBatch>> getBatchesByProductId(@PathVariable Long productId) {
        try {
            List<InventoryBatch> batches = batchService.getBatchesByProductId(productId);
            return ApiResponse.success(batches);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/records/{batchNo}")
    public ApiResponse<Map<String, Object>> getBatchRecordsByBatchNo(@PathVariable String batchNo) {
        try {
            Map<String, Object> result = batchService.getBatchRecordsByBatchNo(batchNo);
            return ApiResponse.success(result);
        } catch (SecurityException e) {
            return ApiResponse.error(403, e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
