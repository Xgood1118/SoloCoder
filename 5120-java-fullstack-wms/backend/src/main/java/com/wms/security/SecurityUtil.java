package com.wms.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class SecurityUtil {

    public UserPrincipal getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal) {
            return (UserPrincipal) authentication.getPrincipal();
        }
        return null;
    }

    public Long getCurrentUserId() {
        UserPrincipal user = getCurrentUser();
        return user != null ? user.getUserId() : null;
    }

    public String getCurrentUsername() {
        UserPrincipal user = getCurrentUser();
        return user != null ? user.getUsername() : null;
    }

    public String getCurrentUserRole() {
        UserPrincipal user = getCurrentUser();
        return user != null ? user.getRole() : null;
    }

    public Long getCurrentUserWarehouseId() {
        UserPrincipal user = getCurrentUser();
        return user != null ? user.getWarehouseId() : null;
    }

    public boolean isCurrentUserAdmin() {
        UserPrincipal user = getCurrentUser();
        return user != null && user.isAdmin();
    }

    public boolean canAccessWarehouse(Long warehouseId) {
        UserPrincipal user = getCurrentUser();
        if (user == null) {
            return false;
        }
        return user.canAccessWarehouse(warehouseId);
    }

    public void checkWarehouseAccess(Long warehouseId) {
        if (!canAccessWarehouse(warehouseId)) {
            throw new SecurityException("无权限访问该仓库数据");
        }
    }
}
