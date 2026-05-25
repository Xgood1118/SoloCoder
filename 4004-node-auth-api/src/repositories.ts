import { execute, getDb, inTx, queryAll, queryOne } from './db';
import { DepartmentRecord, MenuRecord, RoleRecord, UserRecord } from './types';

const USER_FIELDS = `id, username, password_hash, name, avatar, email, phone, department_id,
  status, failed_attempts, locked_until, password_changed_at, must_change_password,
  created_at, updated_at`;

export function getUserById(id: number): UserRecord | null {
  return queryOne<UserRecord>(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [id]);
}

export function getUserByUsername(username: string): UserRecord | null {
  return queryOne<UserRecord>(`SELECT ${USER_FIELDS} FROM users WHERE username = ?`, [username]);
}

export function createUser(input: {
  username: string;
  password_hash: string;
  name: string;
  avatar?: string | null;
  email?: string | null;
  phone?: string | null;
  department_id?: number | null;
  status?: string;
  must_change_password?: boolean;
}): { id: number } {
  const info = execute(
    `INSERT INTO users (username, password_hash, name, avatar, email, phone, department_id, status, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.username,
      input.password_hash,
      input.name,
      input.avatar ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.department_id ?? null,
      input.status ?? 'active',
      input.must_change_password ? 1 : 0,
    ]
  );
  return { id: Number(info.lastInsertRowid) };
}

export function updateUserFailedAttempts(userId: number, attempts: number, lockedUntil: string | null): void {
  execute(
    `UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?`,
    [attempts, lockedUntil, userId]
  );
}

export function resetUserFailedAttempts(userId: number): void {
  execute(
    `UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`,
    [userId]
  );
}

export function updateUserPassword(userId: number, passwordHash: string, mustChange: boolean = false): void {
  execute(
    `UPDATE users SET password_hash = ?, must_change_password = ?, password_changed_at = datetime('now'),
     failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`,
    [passwordHash, mustChange ? 1 : 0, userId]
  );
}

export function listUserRoles(userId: number): RoleRecord[] {
  return queryAll<RoleRecord>(
    `SELECT r.id, r.code, r.name, r.description, r.is_system
     FROM roles r INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ?`,
    [userId]
  );
}

export function assignUserRoles(userId: number, roleIds: number[]): void {
  inTx(() => {
    execute(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    const stmt = getDb().prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`);
    for (const rid of roleIds) stmt.run(userId, rid);
  });
}

export function getRoleByCode(code: string): RoleRecord | null {
  return queryOne<RoleRecord>(`SELECT * FROM roles WHERE code = ?`, [code]);
}

export function listRolePermissionCodes(roleId: number): string[] {
  const rows = queryAll<{ code: string }>(
    `SELECT p.code FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = ?`,
    [roleId]
  );
  return rows.map(r => r.code);
}

export function listPermissionsByRoleIds(roleIds: number[]): string[] {
  if (roleIds.length === 0) return [];
  const placeholders = roleIds.map(() => '?').join(',');
  const rows = queryAll<{ code: string }>(
    `SELECT DISTINCT p.code FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id IN (${placeholders})`,
    roleIds
  );
  return rows.map(r => r.code);
}

export function createRole(input: { code: string; name: string; description?: string; is_system?: boolean }): { id: number } {
  const info = execute(
    `INSERT INTO roles (code, name, description, is_system) VALUES (?, ?, ?, ?)`,
    [input.code, input.name, input.description ?? null, input.is_system ? 1 : 0]
  );
  return { id: Number(info.lastInsertRowid) };
}

export function createPermission(input: { code: string; name: string; resource: string; action: string; description?: string }): { id: number } {
  const info = execute(
    `INSERT INTO permissions (code, name, resource, action, description) VALUES (?, ?, ?, ?, ?)`,
    [input.code, input.name, input.resource, input.action, input.description ?? null]
  );
  return { id: Number(info.lastInsertRowid) };
}

export function assignPermissionToRole(roleId: number, permissionId: number): void {
  execute(
    `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
    [roleId, permissionId]
  );
}

export function getDepartmentById(id: number): DepartmentRecord | null {
  return queryOne<DepartmentRecord>(`SELECT * FROM departments WHERE id = ?`, [id]);
}

export function createDepartment(input: { name: string; parent_id?: number | null; sort?: number }): { id: number } {
  return inTx(() => {
    let parent: DepartmentRecord | null = null;
    if (input.parent_id) {
      parent = getDepartmentById(input.parent_id);
      if (!parent) throw new Error(`Parent department ${input.parent_id} not found`);
    }
    const info = execute(
      `INSERT INTO departments (parent_id, name, path, level, sort) VALUES (?, ?, '', 0, ?)`,
      [input.parent_id ?? null, input.name, input.sort ?? 0]
    );
    const id = Number(info.lastInsertRowid);
    const path = parent ? `${parent.path}${id}/` : `/${id}/`;
    const level = parent ? parent.level + 1 : 1;
    execute(`UPDATE departments SET path = ?, level = ? WHERE id = ?`, [path, level, id]);
    return { id };
  });
}

export function listAllDepartments(): DepartmentRecord[] {
  return queryAll<DepartmentRecord>(`SELECT * FROM departments ORDER BY level ASC, sort ASC, id ASC`);
}

export function getDepartmentAncestorIds(id: number): number[] {
  const dept = getDepartmentById(id);
  if (!dept) return [];
  const ids = dept.path.split('/').filter(Boolean).map(Number);
  return ids;
}

export function getDepartmentDescendantIds(id: number): number[] {
  const dept = getDepartmentById(id);
  if (!dept) return [];
  const prefix = dept.path;
  const rows = queryAll<{ id: number }>(
    `SELECT id FROM departments WHERE path LIKE ? OR id = ?`,
    [`${prefix}%`, id]
  );
  return rows.map(r => r.id);
}

export function createMenu(input: {
  name: string;
  path?: string | null;
  icon?: string | null;
  parent_id?: number | null;
  permission_code?: string | null;
  sort?: number;
  is_visible?: boolean;
}): { id: number } {
  const info = execute(
    `INSERT INTO menus (parent_id, name, path, icon, permission_code, sort, is_visible)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.parent_id ?? null,
      input.name,
      input.path ?? null,
      input.icon ?? null,
      input.permission_code ?? null,
      input.sort ?? 0,
      input.is_visible === false ? 0 : 1,
    ]
  );
  return { id: Number(info.lastInsertRowid) };
}

export function listAllMenus(): MenuRecord[] {
  return queryAll<MenuRecord>(`SELECT * FROM menus ORDER BY sort ASC, id ASC`);
}
