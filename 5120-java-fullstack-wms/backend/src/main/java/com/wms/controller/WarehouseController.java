package com.wms.controller;

import com.wms.dto.ApiResponse;
import com.wms.entity.Warehouse;
import com.wms.repository.WarehouseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/warehouse")
public class WarehouseController {

    @Autowired
    private WarehouseRepository warehouseRepository;

    @GetMapping("/list")
    public ApiResponse<List<Warehouse>> getWarehouseList() {
        try {
            List<Warehouse> warehouses = warehouseRepository.findByEnabledTrue();
            return ApiResponse.success(warehouses);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
