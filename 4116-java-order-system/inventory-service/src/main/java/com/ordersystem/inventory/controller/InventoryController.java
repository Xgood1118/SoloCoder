package com.ordersystem.inventory.controller;

import com.ordersystem.common.result.ApiResult;
import com.ordersystem.inventory.model.Inventory;
import com.ordersystem.inventory.service.InventoryService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/{skuId}")
    public ApiResult<List<Inventory>> getStock(@PathVariable Long skuId) {
        return ApiResult.success(inventoryService.getStock(skuId));
    }

    @PostMapping("/preoccupy")
    public ApiResult<Inventory> preoccupy(@RequestBody PreoccupyRequest request) {
        return ApiResult.success(inventoryService.preoccupy(request.getSkuId(), request.getQty(), request.getWarehouseId()));
    }

    @PostMapping("/release")
    public ApiResult<Inventory> release(@RequestBody ReleaseRequest request) {
        return ApiResult.success(inventoryService.release(request.getSkuId(), request.getQty(), request.getWarehouseId()));
    }

    @PostMapping("/confirm")
    public ApiResult<Inventory> confirm(@RequestBody ConfirmRequest request) {
        return ApiResult.success(inventoryService.confirm(request.getSkuId(), request.getQty(), request.getWarehouseId()));
    }

    @Data
    public static class PreoccupyRequest {
        private Long skuId;
        private int qty;
        private Long warehouseId;
    }

    @Data
    public static class ReleaseRequest {
        private Long skuId;
        private int qty;
        private Long warehouseId;
    }

    @Data
    public static class ConfirmRequest {
        private Long skuId;
        private int qty;
        private Long warehouseId;
    }
}
