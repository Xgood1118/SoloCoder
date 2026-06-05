package com.wms.controller;

import com.wms.dto.ApiResponse;
import com.wms.entity.Product;
import com.wms.repository.ProductRepository;
import com.wms.security.SecurityUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/product")
public class ProductController {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SecurityUtil securityUtil;

    @GetMapping("/list")
    public ApiResponse<Page<Product>> getProductList(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Long userWarehouseId = securityUtil.getCurrentUserWarehouseId();
            boolean isAdmin = securityUtil.isCurrentUserAdmin();

            if (!isAdmin && userWarehouseId != null) {
                warehouseId = userWarehouseId;
            }

            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            Page<Product> result;

            if (warehouseId != null) {
                securityUtil.checkWarehouseAccess(warehouseId);
                result = productRepository.findByWarehouseIdAndNameContaining(warehouseId, name != null ? name : "", pageable);
            } else {
                if (name != null && !name.isEmpty()) {
                    result = productRepository.findByNameContainingPage(name, pageable);
                } else {
                    result = productRepository.findAll(pageable);
                }
            }

            return ApiResponse.success(result);
        } catch (SecurityException e) {
            return ApiResponse.error(403, e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
