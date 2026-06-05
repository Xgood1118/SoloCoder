package com.wms.security;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserPrincipal {
    private Long userId;
    private String username;
    private String role;
    private Long warehouseId;

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }

    public boolean canAccessWarehouse(Long targetWarehouseId) {
        if (isAdmin()) {
            return true;
        }
        return warehouseId != null && warehouseId.equals(targetWarehouseId);
    }
}
