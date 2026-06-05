package com.wms.controller;

import com.wms.dto.ApiResponse;
import com.wms.dto.StockInRequest;
import com.wms.dto.StockOutRequest;
import com.wms.entity.StockRecord;
import com.wms.service.StockService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/stock")
public class StockController {

    @Autowired
    private StockService stockService;

    @PostMapping("/in")
    public ApiResponse<StockRecord> stockIn(@Valid @RequestBody StockInRequest request) {
        try {
            StockRecord record = stockService.stockIn(request);
            return ApiResponse.success("入库成功", record);
        } catch (SecurityException e) {
            return ApiResponse.error(403, e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/out")
    public ApiResponse<StockRecord> stockOut(@Valid @RequestBody StockOutRequest request) {
        try {
            StockRecord record = stockService.stockOut(request);
            return ApiResponse.success("出库成功", record);
        } catch (SecurityException e) {
            return ApiResponse.error(403, e.getMessage());
        } catch (RuntimeException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
