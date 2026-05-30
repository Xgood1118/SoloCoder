package com.bpm.engine.task.organization;

import java.util.List;

public interface OrganizationService {

    List<String> getUserIdsByRole(String roleId);

    List<String> getUserIdsByDepartment(String departmentId);

    String getDepartmentManager(String departmentId);

    String getUserDepartment(String userId);

    String getDepartmentParent(String departmentId);

    boolean isUserActive(String userId);

    UserInfo getUserInfo(String userId);

    void onUserTransferred(String userId, String newDepartmentId);

    void onUserLeft(String userId);
}
