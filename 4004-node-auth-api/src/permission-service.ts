import {
  getUserById,
  listUserRoles,
  listPermissionsByRoleIds,
  getDepartmentById,
  getDepartmentAncestorIds,
  getDepartmentDescendantIds,
} from './repositories';
import { Errors } from './utils/errors';

export function hasPermission(userId: number, permissionCode: string): boolean {
  const user = getUserById(userId);
  if (!user) return false;

  const roles = listUserRoles(userId);
  const roleIds = roles.map(r => r.id);
  const permissions = new Set(listPermissionsByRoleIds(roleIds));

  if (permissions.has(permissionCode)) return true;

  if (permissions.has('system:manage')) return true;

  if (permissionCode.startsWith('dept:manage:') && user.department_id) {
    const targetDeptId = parseInt(permissionCode.split(':')[2], 10);
    if (!isNaN(targetDeptId)) {
      const descIds = getDepartmentDescendantIds(user.department_id);
      if (descIds.includes(targetDeptId)) return true;
    }
  }

  return false;
}

export function checkUserPermissions(userId: number, permissionCodes: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const code of permissionCodes) {
    result[code] = hasPermission(userId, code);
  }
  return result;
}

export function listUserPermissions(userId: number): string[] {
  const user = getUserById(userId);
  if (!user) return [];

  const roles = listUserRoles(userId);
  const roleIds = roles.map(r => r.id);
  const permissions = listPermissionsByRoleIds(roleIds);

  const result = new Set(permissions);
  const isDeptAdmin = roles.some(r => r.code === 'dept_admin' || r.code === 'admin');

  if (isDeptAdmin && user.department_id) {
    const descIds = getDepartmentDescendantIds(user.department_id);
    for (const did of descIds) {
      result.add(`dept:manage:${did}`);
    }
  }

  return Array.from(result);
}
