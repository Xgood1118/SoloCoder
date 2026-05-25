import {
  getUserById,
  listUserRoles,
  listPermissionsByRoleIds,
  getDepartmentById,
  getDepartmentAncestorIds,
  listAllMenus,
} from './repositories';
import { getSessionById } from './session-repository';
import { MenuRecord, RoleRecord, UserRecord } from './types';
import { Errors } from './utils/errors';

export interface UserInfo {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  department: {
    id: number;
    name: string;
    path: string;
    level: number;
  } | null;
  roles: { code: string; name: string }[];
  permissions: string[];
  menus: MenuNode[];
  mustChangePassword: boolean;
  passwordExpiresAt: string;
}

export interface MenuNode {
  id: number;
  name: string;
  path: string | null;
  icon: string | null;
  children: MenuNode[];
}

function buildMenuTree(allMenus: MenuRecord[], permissionCodes: Set<string>): MenuNode[] {
  const visible = allMenus.filter(m => m.is_visible === 1 &&
    (!m.permission_code || permissionCodes.has(m.permission_code)));

  const map = new Map<number, MenuNode>();
  for (const m of visible) {
    map.set(m.id, { id: m.id, name: m.name, path: m.path, icon: m.icon, children: [] });
  }

  const roots: MenuNode[] = [];
  for (const m of visible) {
    const node = map.get(m.id)!;
    if (m.parent_id && map.has(m.parent_id)) {
      map.get(m.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortTree(nodes: MenuNode[]): void {
    nodes.sort((a, b) => a.id - b.id);
    for (const n of nodes) sortTree(n.children);
  }
  sortTree(roots);
  return roots;
}

export async function getUserInfo(userId: number, sessionId: string): Promise<UserInfo> {
  const user = getUserById(userId);
  if (!user) throw Errors.NotFound('User not found');

  const roles = listUserRoles(userId);
  const roleIds = roles.map(r => r.id);
  const permissions = listPermissionsByRoleIds(roleIds);

  const session = getSessionById(sessionId);
  const isDeptAdmin = roles.some(r => r.code === 'dept_admin' || r.code === 'admin');

  let effectivePerms = new Set(permissions);

  if (isDeptAdmin && user.department_id) {
    const dept = getDepartmentById(user.department_id);
    if (dept) {
      const ancestorIds = getDepartmentAncestorIds(user.department_id);
      for (const aid of ancestorIds) {
        effectivePerms.add(`dept:manage:${aid}`);
      }
    }
  }

  let deptInfo = null;
  if (user.department_id) {
    const dept = getDepartmentById(user.department_id);
    if (dept) {
      deptInfo = { id: dept.id, name: dept.name, path: dept.path, level: dept.level };
    }
  }

  const allMenus = listAllMenus();
  const menus = buildMenuTree(allMenus, effectivePerms);

  const pwdChangedAt = new Date(user.password_changed_at);
  const pwdExpireDays = Number(process.env.PASSWORD_EXPIRE_DAYS || 90);
  const passwordExpiresAt = new Date(pwdChangedAt.getTime() + pwdExpireDays * 24 * 3600 * 1000).toISOString();

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    email: user.email,
    phone: user.phone,
    department: deptInfo,
    roles: roles.map(r => ({ code: r.code, name: r.name })),
    permissions: Array.from(effectivePerms),
    menus,
    mustChangePassword: user.must_change_password === 1,
    passwordExpiresAt,
  };
}
