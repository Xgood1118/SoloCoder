package com.wms.service;

import com.wms.dto.InventoryDTO;
import com.wms.entity.Inventory;
import com.wms.entity.Product;
import com.wms.entity.Warehouse;
import com.wms.repository.InventoryRepository;
import com.wms.repository.ProductRepository;
import com.wms.repository.WarehouseRepository;
import com.wms.security.SecurityUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class InventoryService {

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private SecurityUtil securityUtil;

    public Page<InventoryDTO> getInventoryList(String productName, Long warehouseId, Pageable pageable) {
        Long userWarehouseId = securityUtil.getCurrentUserWarehouseId();
        boolean isAdmin = securityUtil.isCurrentUserAdmin();

        if (!isAdmin && userWarehouseId != null) {
            warehouseId = userWarehouseId;
        }

        Page<Inventory> inventoryPage;

        if (warehouseId != null) {
            securityUtil.checkWarehouseAccess(warehouseId);
            inventoryPage = inventoryRepository.findByWarehouseIdAndProductNameContaining(
                    warehouseId, productName != null ? productName : "", pageable);
        } else {
            if (productName != null && !productName.isEmpty()) {
                inventoryPage = inventoryRepository.findByProductNameContaining(productName, pageable);
            } else {
                inventoryPage = inventoryRepository.findAll(pageable);
            }
        }

        return inventoryPage.map(this::convertToDTO);
    }

    private InventoryDTO convertToDTO(Inventory inventory) {
        InventoryDTO dto = new InventoryDTO();
        dto.setId(inventory.getId());
        dto.setProductId(inventory.getProductId());
        dto.setWarehouseId(inventory.getWarehouseId());
        dto.setTotalQuantity(inventory.getTotalQuantity());
        dto.setLastInTime(inventory.getLastInTime());
        dto.setLastOutTime(inventory.getLastOutTime());
        dto.setUpdatedAt(inventory.getUpdatedAt());

        Optional<Product> productOpt = productRepository.findById(inventory.getProductId());
        if (productOpt.isPresent()) {
            Product product = productOpt.get();
            dto.setProductName(product.getName());
            dto.setProductCode(product.getCode());
            dto.setCategory(product.getCategory());
            dto.setUnit(product.getUnit());
            dto.setWarningThreshold(product.getWarningThreshold());
        }

        Optional<Warehouse> warehouseOpt = warehouseRepository.findById(inventory.getWarehouseId());
        warehouseOpt.ifPresent(warehouse -> dto.setWarehouseName(warehouse.getName()));

        return dto;
    }
}
