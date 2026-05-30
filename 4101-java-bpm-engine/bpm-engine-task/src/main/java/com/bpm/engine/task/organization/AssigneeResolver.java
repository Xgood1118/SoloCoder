package com.bpm.engine.task.organization;

import com.bpm.engine.common.exception.OrganizationIntegrationException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class AssigneeResolver {

    private static final int MAX_UPWARD_DEPTH = 10;

    private final OrganizationService organizationService;

    public List<String> resolveAssignee(String expression, Map<String, Object> variables) {
        if (expression == null || expression.isEmpty()) {
            return List.of();
        }

        if (expression.startsWith("user:")) {
            String userId = expression.substring("user:".length());
            return List.of(userId);
        }

        if (expression.startsWith("role:")) {
            String roleId = expression.substring("role:".length());
            return organizationService.getUserIdsByRole(roleId);
        }

        if (expression.startsWith("dept:") || expression.startsWith("department:")) {
            String prefix = expression.startsWith("dept:") ? "dept:" : "department:";
            String departmentId = expression.substring(prefix.length());
            return organizationService.getUserIdsByDepartment(departmentId);
        }

        if (expression.startsWith("${") && expression.endsWith("}")) {
            String varName = expression.substring(2, expression.length() - 1);
            Object value = variables != null ? variables.get(varName) : null;
            if (value instanceof String) {
                return List.of((String) value);
            }
            if (value instanceof List) {
                List<String> result = new ArrayList<>();
                for (Object item : (List<?>) value) {
                    if (item instanceof String) {
                        result.add((String) item);
                    }
                }
                return result;
            }
            return List.of();
        }

        return List.of(expression);
    }

    public List<String> resolveAssigneeWithFallback(String expression, Map<String, Object> variables) {
        List<String> assignees = resolveAssignee(expression, variables);
        if (!assignees.isEmpty()) {
            return assignees;
        }

        if (expression.startsWith("dept:") || expression.startsWith("department:")) {
            String prefix = expression.startsWith("dept:") ? "dept:" : "department:";
            String departmentId = expression.substring(prefix.length());
            String managerId = resolveUpwardRouting(departmentId);
            if (managerId != null) {
                return List.of(managerId);
            }
        }

        return List.of();
    }

    public String resolveUpwardRouting(String departmentId) {
        if (departmentId == null) {
            return null;
        }

        String currentDeptId = departmentId;
        for (int i = 0; i < MAX_UPWARD_DEPTH; i++) {
            try {
                String managerId = organizationService.getDepartmentManager(currentDeptId);
                if (managerId != null && organizationService.isUserActive(managerId)) {
                    return managerId;
                }
            } catch (OrganizationIntegrationException e) {
                return null;
            }

            String parentDeptId = organizationService.getDepartmentParent(currentDeptId);
            if (parentDeptId == null || parentDeptId.equals(currentDeptId)) {
                return null;
            }
            currentDeptId = parentDeptId;
        }

        return null;
    }
}
