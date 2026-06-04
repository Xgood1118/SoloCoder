package com.ecommerce.inventory.controller;

import com.ecommerce.common.ApiResponse;
import com.ecommerce.inventory.entity.Inventory;
import com.ecommerce.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventories")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @PostMapping
    public ApiResponse<Inventory> initInventory(@RequestParam Long skuId, @RequestParam Integer totalStock) {
        return ApiResponse.success(inventoryService.initInventory(skuId, totalStock));
    }

    @GetMapping("/{skuId}")
    public ApiResponse<Inventory> getInventory(@PathVariable Long skuId) {
        return ApiResponse.success(inventoryService.getInventory(skuId));
    }

    @GetMapping
    public ApiResponse<List<Inventory>> listAllInventory() {
        return ApiResponse.success(inventoryService.listAllInventory());
    }

    @PutMapping("/{skuId}/adjust")
    public ApiResponse<Inventory> adjustStock(@PathVariable Long skuId, @RequestParam Integer newTotalStock) {
        return ApiResponse.success(inventoryService.adjustStock(skuId, newTotalStock));
    }
}
