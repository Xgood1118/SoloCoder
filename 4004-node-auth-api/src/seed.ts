import 'dotenv/config';
import { getDb } from './db';
import { hashPassword } from './utils/password';
import {
  assignPermissionToRole,
  assignUserRoles,
  createDepartment,
  createMenu,
  createPermission,
  createRole,
  createUser,
  getRoleByCode,
} from './repositories';

function seed() {
  getDb();

  const perms = [
    { code: 'user:read', name: '查看用户', resource: 'user', action: 'read' },
    { code: 'user:write', name: '编辑用户', resource: 'user', action: 'write' },
    { code: 'role:read', name: '查看角色', resource: 'role', action: 'read' },
    { code: 'role:write', name: '编辑角色', resource: 'role', action: 'write' },
    { code: 'dept:read', name: '查看部门', resource: 'department', action: 'read' },
    { code: 'dept:write', name: '编辑部门', resource: 'department', action: 'write' },
    { code: 'menu:read', name: '查看菜单', resource: 'menu', action: 'read' },
    { code: 'log:read', name: '查看日志', resource: 'log', action: 'read' },
    { code: 'system:manage', name: '系统管理', resource: 'system', action: 'manage' },
  ];
  const permIds = perms.map(p => createPermission(p).id);

  const adminRole = createRole({ code: 'admin', name: '超级管理员', description: '拥有所有权限', is_system: true });
  const deptAdminRole = createRole({ code: 'dept_admin', name: '部门管理员', description: '管理所在部门及子部门' });
  const userRole = createRole({ code: 'user', name: '普通用户', description: '基础用户' });

  for (const pid of permIds) assignPermissionToRole(adminRole.id, pid);
  [0, 2, 4, 6].forEach(i => assignPermissionToRole(deptAdminRole.id, permIds[i]));
  [0, 4, 6].forEach(i => assignPermissionToRole(userRole.id, permIds[i]));

  const root = createDepartment({ name: '总公司', sort: 0 });
  const tech = createDepartment({ name: '技术部', parent_id: root.id, sort: 1 });
  const backend = createDepartment({ name: '后端组', parent_id: tech.id, sort: 1 });
  const frontend = createDepartment({ name: '前端组', parent_id: tech.id, sort: 2 });
  const sales = createDepartment({ name: '销售部', parent_id: root.id, sort: 2 });

  const admin = createUser({
    username: 'admin',
    password_hash: hashPassword('Admin@123'),
    name: '系统管理员',
    avatar: null,
    email: 'admin@example.com',
    department_id: root.id,
    status: 'active',
  });
  assignUserRoles(admin.id, [adminRole.id]);

  const techLead = createUser({
    username: 'techlead',
    password_hash: hashPassword('Tech@123'),
    name: '技术总监',
    email: 'techlead@example.com',
    department_id: tech.id,
    status: 'active',
  });
  assignUserRoles(techLead.id, [deptAdminRole.id]);

  const dev1 = createUser({
    username: 'dev1',
    password_hash: hashPassword('Dev@123'),
    name: '后端工程师',
    email: 'dev1@example.com',
    department_id: backend.id,
    status: 'active',
  });
  assignUserRoles(dev1.id, [userRole.id]);

  const dev2 = createUser({
    username: 'dev2',
    password_hash: hashPassword('Dev@123'),
    name: '前端工程师',
    email: 'dev2@example.com',
    department_id: frontend.id,
    status: 'active',
  });
  assignUserRoles(dev2.id, [userRole.id]);

  const salesLead = createUser({
    username: 'saleslead',
    password_hash: hashPassword('Sales@123'),
    name: '销售总监',
    email: 'saleslead@example.com',
    department_id: sales.id,
    status: 'active',
  });
  assignUserRoles(salesLead.id, [deptAdminRole.id]);

  const dashboard = createMenu({ name: '仪表盘', path: '/dashboard', icon: 'home', permission_code: null });
  const system = createMenu({ name: '系统管理', path: '/system', icon: 'settings', permission_code: 'system:manage' });
  createMenu({ name: '用户管理', path: '/system/users', parent_id: system.id, permission_code: 'user:read' });
  createMenu({ name: '角色管理', path: '/system/roles', parent_id: system.id, permission_code: 'role:read' });
  createMenu({ name: '部门管理', path: '/system/departments', parent_id: system.id, permission_code: 'dept:read' });
  createMenu({ name: '日志审计', path: '/system/logs', parent_id: system.id, permission_code: 'log:read' });

  void admin;
  void techLead;
  void dev1;
  void dev2;
  void salesLead;
  void dashboard;

  console.log('Seed complete. Default users: admin/Admin@123, techlead/Tech@123, dev1/Dev@123, dev2/Dev@123, saleslead/Sales@123');
}

if (require.main === module) {
  const existing = getRoleByCode('admin');
  if (existing) {
    console.log('Database already seeded. Skipping.');
    process.exit(0);
  }
  seed();
}
