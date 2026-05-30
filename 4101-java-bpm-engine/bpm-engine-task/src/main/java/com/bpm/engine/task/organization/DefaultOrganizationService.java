package com.bpm.engine.task.organization;

import com.bpm.engine.common.exception.OrganizationIntegrationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@ConditionalOnMissingBean(OrganizationService.class)
public class DefaultOrganizationService implements OrganizationService {

    private final Map<String, UserInfo> userInfoCache = new ConcurrentHashMap<>();

    @Override
    public List<String> getUserIdsByRole(String roleId) {
        throw new OrganizationIntegrationException("ORG_NOT_IMPLEMENTED",
                "OrganizationService.getUserIdsByRole not implemented. Please provide your own implementation.");
    }

    @Override
    public List<String> getUserIdsByDepartment(String departmentId) {
        throw new OrganizationIntegrationException("ORG_NOT_IMPLEMENTED",
                "OrganizationService.getUserIdsByDepartment not implemented. Please provide your own implementation.");
    }

    @Override
    public String getDepartmentManager(String departmentId) {
        throw new OrganizationIntegrationException("ORG_NOT_IMPLEMENTED",
                "OrganizationService.getDepartmentManager not implemented. Please provide your own implementation.");
    }

    @Override
    public String getUserDepartment(String userId) {
        throw new OrganizationIntegrationException("ORG_NOT_IMPLEMENTED",
                "OrganizationService.getUserDepartment not implemented. Please provide your own implementation.");
    }

    @Override
    public String getDepartmentParent(String departmentId) {
        throw new OrganizationIntegrationException("ORG_NOT_IMPLEMENTED",
                "OrganizationService.getDepartmentParent not implemented. Please provide your own implementation.");
    }

    @Override
    public boolean isUserActive(String userId) {
        UserInfo cached = userInfoCache.get(userId);
        if (cached != null) {
            return cached.isActive();
        }
        throw new OrganizationIntegrationException("ORG_NOT_IMPLEMENTED",
                "OrganizationService.isUserActive not implemented. Please provide your own implementation.");
    }

    @Override
    public UserInfo getUserInfo(String userId) {
        return userInfoCache.get(userId);
    }

    @Override
    public void onUserTransferred(String userId, String newDepartmentId) {
        throw new OrganizationIntegrationException("ORG_NOT_IMPLEMENTED",
                "OrganizationService.onUserTransferred not implemented. Please provide your own implementation.");
    }

    @Override
    public void onUserLeft(String userId) {
        throw new OrganizationIntegrationException("ORG_NOT_IMPLEMENTED",
                "OrganizationService.onUserLeft not implemented. Please provide your own implementation.");
    }
}
