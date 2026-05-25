export interface User {
  id: string
  name: string
  employeeId: string
  phone: string
  email: string
  departmentId: string
  departmentName: string
  position: string
  hireDate: string
  roles: string[]
  status: 'active' | 'inactive' | 'resigned'
  lastLoginTime: string | null
  createdAt: string
  updatedAt: string
  password?: string
  isFirstLogin?: boolean
}

export interface Department {
  id: string
  name: string
  parentId: string | null
  leaderId: string | null
  leaderName: string | null
  quota: number
  sortOrder: number
  children?: Department[]
  userCount?: number
}

export interface Role {
  id: string
  name: string
  code: string
  description: string
  menuPermissions: MenuPermission[]
  dataPermissions: DataPermission
  isSystem: boolean
}

export interface MenuPermission {
  menuId: string
  menuName: string
  canView: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}

export interface DataPermission {
  type: 'all' | 'department' | 'departmentAndChildren' | 'self' | 'custom'
  departmentIds: string[]
}

export interface OperationLog {
  id: string
  userId: string
  userName: string
  action: string
  targetType: string
  targetId: string | null
  targetName: string | null
  detail: string
  ip: string
  createdAt: string
}

export interface ColumnConfig {
  key: string
  title: string
  visible: boolean
  width?: number
  fixed?: 'left' | 'right'
}

export interface SearchParams {
  name?: string
  employeeId?: string
  departmentId?: string
  roleId?: string
  status?: string
  page: number
  pageSize: number
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export interface CurrentUser {
  id: string
  name: string
  roles: string[]
  departmentId: string
  isSuperAdmin: boolean
}
