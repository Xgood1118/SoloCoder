import { storage } from './storage'
import { generateId, generatePassword, generateEmployeeId, getCurrentTime } from './helpers'

const initDepartments = () => {
  const existing = storage.getDepartments()
  if (existing) return existing

  const departments = [
    {
      id: 'dept_1',
      name: '总公司',
      parentId: null,
      leaderId: null,
      leaderName: null,
      quota: 50,
      sortOrder: 1,
    },
    {
      id: 'dept_2',
      name: '技术部',
      parentId: 'dept_1',
      leaderId: null,
      leaderName: null,
      quota: 20,
      sortOrder: 1,
    },
    {
      id: 'dept_3',
      name: '前端组',
      parentId: 'dept_2',
      leaderId: null,
      leaderName: null,
      quota: 8,
      sortOrder: 1,
    },
    {
      id: 'dept_4',
      name: '后端组',
      parentId: 'dept_2',
      leaderId: null,
      leaderName: null,
      quota: 8,
      sortOrder: 2,
    },
    {
      id: 'dept_5',
      name: '产品部',
      parentId: 'dept_1',
      leaderId: null,
      leaderName: null,
      quota: 10,
      sortOrder: 2,
    },
    {
      id: 'dept_6',
      name: '市场部',
      parentId: 'dept_1',
      leaderId: null,
      leaderName: null,
      quota: 15,
      sortOrder: 3,
    },
    {
      id: 'dept_7',
      name: '人事部',
      parentId: 'dept_1',
      leaderId: null,
      leaderName: null,
      quota: 5,
      sortOrder: 4,
    },
  ]

  storage.setDepartments(departments)
  return departments
}

const initRoles = () => {
  const existing = storage.getRoles()
  if (existing) return existing

  const roles = [
    {
      id: 'role_1',
      name: '超级管理员',
      code: 'super_admin',
      description: '拥有所有权限',
      isSystem: true,
      menuPermissions: [
        { menuId: 'user', menuName: '用户管理', canView: true, canAdd: true, canEdit: true, canDelete: true },
        { menuId: 'department', menuName: '部门管理', canView: true, canAdd: true, canEdit: true, canDelete: true },
        { menuId: 'role', menuName: '角色管理', canView: true, canAdd: true, canEdit: true, canDelete: true },
        { menuId: 'permission', menuName: '权限配置', canView: true, canAdd: true, canEdit: true, canDelete: true },
        { menuId: 'log', menuName: '操作日志', canView: true, canAdd: false, canEdit: false, canDelete: false },
      ],
      dataPermissions: {
        type: 'all',
        departmentIds: [],
      },
    },
    {
      id: 'role_2',
      name: '部门管理员',
      code: 'dept_admin',
      description: '管理本部门及下属部门',
      isSystem: true,
      menuPermissions: [
        { menuId: 'user', menuName: '用户管理', canView: true, canAdd: true, canEdit: true, canDelete: false },
        { menuId: 'department', menuName: '部门管理', canView: true, canAdd: false, canEdit: false, canDelete: false },
        { menuId: 'role', menuName: '角色管理', canView: true, canAdd: false, canEdit: false, canDelete: false },
        { menuId: 'permission', menuName: '权限配置', canView: false, canAdd: false, canEdit: false, canDelete: false },
        { menuId: 'log', menuName: '操作日志', canView: true, canAdd: false, canEdit: false, canDelete: false },
      ],
      dataPermissions: {
        type: 'departmentAndChildren',
        departmentIds: [],
      },
    },
    {
      id: 'role_3',
      name: '普通员工',
      code: 'employee',
      description: '普通员工权限',
      isSystem: true,
      menuPermissions: [
        { menuId: 'user', menuName: '用户管理', canView: false, canAdd: false, canEdit: false, canDelete: false },
        { menuId: 'department', menuName: '部门管理', canView: true, canAdd: false, canEdit: false, canDelete: false },
        { menuId: 'role', menuName: '角色管理', canView: false, canAdd: false, canEdit: false, canDelete: false },
        { menuId: 'permission', menuName: '权限配置', canView: false, canAdd: false, canEdit: false, canDelete: false },
        { menuId: 'log', menuName: '操作日志', canView: false, canAdd: false, canEdit: false, canDelete: false },
      ],
      dataPermissions: {
        type: 'self',
        departmentIds: [],
      },
    },
  ]

  storage.setRoles(roles)
  return roles
}

const initUsers = () => {
  const existing = storage.getUsers()
  if (existing) return existing

  const users = [
    {
      id: 'user_1',
      name: '张伟',
      employeeId: '2020001',
      phone: '13800138001',
      email: 'zhangwei@company.com',
      departmentId: 'dept_2',
      departmentName: '技术部',
      position: '技术总监',
      hireDate: '2020-01-15',
      roles: ['role_1'],
      status: 'active',
      lastLoginTime: getCurrentTime(),
      createdAt: '2020-01-15T10:00:00Z',
      updatedAt: '2020-01-15T10:00:00Z',
      password: 'Admin@123',
      isFirstLogin: false,
    },
    {
      id: 'user_2',
      name: '李娜',
      employeeId: '2020002',
      phone: '13800138002',
      email: 'lina@company.com',
      departmentId: 'dept_7',
      departmentName: '人事部',
      position: '人事经理',
      hireDate: '2020-03-20',
      roles: ['role_2'],
      status: 'active',
      lastLoginTime: '2024-01-10T09:30:00Z',
      createdAt: '2020-03-20T10:00:00Z',
      updatedAt: '2020-03-20T10:00:00Z',
      password: 'Admin@123',
      isFirstLogin: false,
    },
    {
      id: 'user_3',
      name: '王强',
      employeeId: '2021001',
      phone: '13800138003',
      email: 'wangqiang@company.com',
      departmentId: 'dept_3',
      departmentName: '前端组',
      position: '前端工程师',
      hireDate: '2021-05-10',
      roles: ['role_3'],
      status: 'active',
      lastLoginTime: '2024-01-12T14:20:00Z',
      createdAt: '2021-05-10T10:00:00Z',
      updatedAt: '2021-05-10T10:00:00Z',
      password: 'Admin@123',
      isFirstLogin: false,
    },
    {
      id: 'user_4',
      name: '刘芳',
      employeeId: '2021002',
      phone: '13800138004',
      email: 'liufang@company.com',
      departmentId: 'dept_4',
      departmentName: '后端组',
      position: '后端工程师',
      hireDate: '2021-06-15',
      roles: ['role_3'],
      status: 'active',
      lastLoginTime: '2024-01-11T10:45:00Z',
      createdAt: '2021-06-15T10:00:00Z',
      updatedAt: '2021-06-15T10:00:00Z',
      password: 'Admin@123',
      isFirstLogin: false,
    },
    {
      id: 'user_5',
      name: '陈明',
      employeeId: '2022001',
      phone: '13800138005',
      email: 'chenming@company.com',
      departmentId: 'dept_5',
      departmentName: '产品部',
      position: '产品经理',
      hireDate: '2022-02-01',
      roles: ['role_2'],
      status: 'active',
      lastLoginTime: '2024-01-13T16:00:00Z',
      createdAt: '2022-02-01T10:00:00Z',
      updatedAt: '2022-02-01T10:00:00Z',
      password: 'Admin@123',
      isFirstLogin: false,
    },
    {
      id: 'user_6',
      name: '赵丽',
      employeeId: '2022002',
      phone: '13800138006',
      email: 'zhaoli@company.com',
      departmentId: 'dept_6',
      departmentName: '市场部',
      position: '市场专员',
      hireDate: '2022-04-10',
      roles: ['role_3'],
      status: 'active',
      lastLoginTime: '2024-01-10T11:30:00Z',
      createdAt: '2022-04-10T10:00:00Z',
      updatedAt: '2022-04-10T10:00:00Z',
      password: 'Admin@123',
      isFirstLogin: false,
    },
    {
      id: 'user_7',
      name: '孙杰',
      employeeId: '2023001',
      phone: '13800138007',
      email: 'sunjie@company.com',
      departmentId: 'dept_3',
      departmentName: '前端组',
      position: '前端实习生',
      hireDate: '2023-07-01',
      roles: ['role_3'],
      status: 'active',
      lastLoginTime: '2024-01-09T09:00:00Z',
      createdAt: '2023-07-01T10:00:00Z',
      updatedAt: '2023-07-01T10:00:00Z',
      password: 'Admin@123',
      isFirstLogin: false,
    },
    {
      id: 'user_8',
      name: '周婷',
      employeeId: '2020003',
      phone: '13800138008',
      email: 'zhouting@company.com',
      departmentId: 'dept_1',
      departmentName: '总公司',
      position: 'CEO',
      hireDate: '2019-06-01',
      roles: ['role_1'],
      status: 'active',
      lastLoginTime: '2024-01-13T18:00:00Z',
      createdAt: '2019-06-01T10:00:00Z',
      updatedAt: '2019-06-01T10:00:00Z',
      password: 'Admin@123',
      isFirstLogin: false,
    },
  ]

  storage.setUsers(users)
  return users
}

const initCurrentUser = () => {
  const existing = storage.getCurrentUser()
  if (existing) return existing

  const currentUser = {
    id: 'user_1',
    name: '张伟',
    roles: ['role_1'],
    departmentId: 'dept_2',
    isSuperAdmin: true,
  }

  storage.setCurrentUser(currentUser)
  return currentUser
}

export const initMockData = () => {
  initDepartments()
  initRoles()
  initUsers()
  initCurrentUser()
}
