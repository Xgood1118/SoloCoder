import { create } from 'zustand'
import { User, Department, Role, OperationLog, CurrentUser, SearchParams, PaginatedResult } from '../types'
import { storage } from '../utils/storage'
import {
  generateId,
  generatePassword,
  generateEmployeeId,
  getCurrentTime,
  getChildDepartmentIds,
  flattenDepartments,
} from '../utils/helpers'

interface UserState {
  users: User[]
  departments: Department[]
  roles: Role[]
  logs: OperationLog[]
  currentUser: CurrentUser | null
  loadData: () => void
  searchUsers: (params: SearchParams) => PaginatedResult<User>
  addUser: (user: Partial<User>) => { success: boolean; message: string; user?: User }
  updateUser: (id: string, user: Partial<User>) => { success: boolean; message: string }
  deleteUser: (id: string) => { success: boolean; message: string }
  resetPassword: (id: string) => { success: boolean; message: string; password?: string }
  importUsers: (usersToImport: Partial<User>[]) => { success: number; failed: number; errors: string[] }
  exportUsers: (filters: any) => User[]
  addLog: (log: Partial<OperationLog>) => void
  getVisiblePhone: (userId: string) => string
  hasPermission: (menuId: string, action: 'canView' | 'canAdd' | 'canEdit' | 'canDelete') => boolean
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  departments: [],
  roles: [],
  logs: [],
  currentUser: null,

  loadData: () => {
    const users = storage.getUsers() || []
    const departments = storage.getDepartments() || []
    const roles = storage.getRoles() || []
    const logs = storage.getLogs() || []
    const currentUser = storage.getCurrentUser()
    set({ users, departments, roles, logs, currentUser })
  },

  searchUsers: (params: SearchParams) => {
    const { users, currentUser } = get()
    let filtered = [...users]

    if (currentUser && !currentUser.isSuperAdmin) {
      const visibleDeptIds = getChildDepartmentIds(currentUser.departmentId, get().departments)
      filtered = filtered.filter((u) => visibleDeptIds.includes(u.departmentId))
    }

    if (params.name) {
      filtered = filtered.filter((u) =>
        u.name.toLowerCase().includes(params.name!.toLowerCase())
      )
    }

    if (params.employeeId) {
      filtered = filtered.filter((u) =>
        u.employeeId.includes(params.employeeId!)
      )
    }

    if (params.departmentId) {
      const deptIds = getChildDepartmentIds(params.departmentId, get().departments)
      filtered = filtered.filter((u) => deptIds.includes(u.departmentId))
    }

    if (params.roleId) {
      filtered = filtered.filter((u) => u.roles.includes(params.roleId!))
    }

    if (params.status) {
      filtered = filtered.filter((u) => u.status === params.status)
    }

    if (params.sortField && params.sortOrder) {
      filtered.sort((a: any, b: any) => {
        const aVal = a[params.sortField!] || ''
        const bVal = b[params.sortField!] || ''
        if (params.sortOrder === 'ascend') {
          return aVal > bVal ? 1 : -1
        }
        return aVal < bVal ? 1 : -1
      })
    }

    const total = filtered.length
    const start = (params.page - 1) * params.pageSize
    const data = filtered.slice(start, start + params.pageSize)

    return { data, total, page: params.page, pageSize: params.pageSize }
  },

  addUser: (userData) => {
    const { users, addLog, currentUser } = get()

    const existingPhone = users.find((u) => u.phone === userData.phone)
    if (existingPhone) {
      return { success: false, message: '手机号已存在' }
    }

    const existingEmployeeId = users.find((u) => u.employeeId === userData.employeeId)
    if (existingEmployeeId) {
      return { success: false, message: '工号已存在' }
    }

    const password = userData.password || generatePassword()
    const employeeId = userData.employeeId || generateEmployeeId()

    const newUser: User = {
      id: generateId(),
      name: userData.name || '',
      employeeId,
      phone: userData.phone || '',
      email: userData.email || '',
      departmentId: userData.departmentId || '',
      departmentName: userData.departmentName || '',
      position: userData.position || '',
      hireDate: userData.hireDate || new Date().toISOString().split('T')[0],
      roles: userData.roles || [],
      status: 'active',
      lastLoginTime: null,
      createdAt: getCurrentTime(),
      updatedAt: getCurrentTime(),
      password,
      isFirstLogin: true,
    }

    const updatedUsers = [...users, newUser]
    storage.setUsers(updatedUsers)
    set({ users: updatedUsers })

    addLog({
      userId: currentUser?.id || '',
      userName: currentUser?.name || '系统',
      action: '新增用户',
      targetType: 'user',
      targetId: newUser.id,
      targetName: newUser.name,
      detail: `创建用户：${newUser.name}（${newUser.employeeId}），初始密码：${password}`,
      ip: '127.0.0.1',
    })

    return { success: true, message: '用户创建成功', user: newUser }
  },

  updateUser: (id, userData) => {
    const { users, addLog, currentUser } = get()

    const index = users.findIndex((u) => u.id === id)
    if (index === -1) {
      return { success: false, message: '用户不存在' }
    }

    const updatedUser = { ...users[index], ...userData, updatedAt: getCurrentTime() }
    const updatedUsers = [...users]
    updatedUsers[index] = updatedUser
    storage.setUsers(updatedUsers)
    set({ users: updatedUsers })

    const changes = Object.keys(userData)
      .map((key) => `${key}: ${userData[key as keyof typeof userData]}`)
      .join(', ')
    addLog({
      userId: currentUser?.id || '',
      userName: currentUser?.name || '系统',
      action: '修改用户',
      targetType: 'user',
      targetId: id,
      targetName: updatedUser.name,
      detail: `修改用户信息：${changes}`,
      ip: '127.0.0.1',
    })

    return { success: true, message: '用户更新成功' }
  },

  deleteUser: (id) => {
    const { users, addLog, currentUser } = get()

    const user = users.find((u) => u.id === id)
    if (!user) {
      return { success: false, message: '用户不存在' }
    }

    const updatedUsers = users.filter((u) => u.id !== id)
    storage.setUsers(updatedUsers)
    set({ users: updatedUsers })

    addLog({
      userId: currentUser?.id || '',
      userName: currentUser?.name || '系统',
      action: '删除用户',
      targetType: 'user',
      targetId: id,
      targetName: user.name,
      detail: `删除用户：${user.name}（${user.employeeId}）`,
      ip: '127.0.0.1',
    })

    return { success: true, message: '用户删除成功' }
  },

  resetPassword: (id) => {
    const { users, addLog, currentUser } = get()

    const index = users.findIndex((u) => u.id === id)
    if (index === -1) {
      return { success: false, message: '用户不存在' }
    }

    const newPassword = generatePassword()
    const updatedUser = { ...users[index], password: newPassword, isFirstLogin: true, updatedAt: getCurrentTime() }
    const updatedUsers = [...users]
    updatedUsers[index] = updatedUser
    storage.setUsers(updatedUsers)
    set({ users: updatedUsers })

    addLog({
      userId: currentUser?.id || '',
      userName: currentUser?.name || '系统',
      action: '重置密码',
      targetType: 'user',
      targetId: id,
      targetName: updatedUser.name,
      detail: `重置用户密码：${updatedUser.name}，新密码：${newPassword}`,
      ip: '127.0.0.1',
    })

    return { success: true, message: '密码重置成功', password: newPassword }
  },

  importUsers: (usersToImport) => {
    const { users, addLog, currentUser } = get()
    const errors: string[] = []
    let successCount = 0
    let failedCount = 0

    const existingUsers = [...users]

    usersToImport.forEach((userData, index) => {
      const row = index + 2

      if (!userData.name) {
        errors.push(`第${row}行：姓名不能为空`)
        failedCount++
        return
      }

      if (userData.phone) {
        const phoneExists = existingUsers.find((u) => u.phone === userData.phone)
        if (phoneExists) {
          errors.push(`第${row}行：手机号 ${userData.phone} 已存在（${userData.name}）`)
          failedCount++
          return
        }
      }

      if (userData.employeeId) {
        const empExists = existingUsers.find((u) => u.employeeId === userData.employeeId)
        if (empExists) {
          errors.push(`第${row}行：工号 ${userData.employeeId} 已存在`)
          failedCount++
          return
        }
      }

      const nameAndPhoneExists = existingUsers.find(
        (u) => u.name === userData.name && u.phone === userData.phone
      )
      if (nameAndPhoneExists) {
        errors.push(`第${row}行：姓名和手机号重复（${userData.name}）`)
        failedCount++
        return
      }

      const password = generatePassword()
      const newUser: User = {
        id: generateId(),
        name: userData.name || '',
        employeeId: userData.employeeId || generateEmployeeId(),
        phone: userData.phone || '',
        email: userData.email || '',
        departmentId: userData.departmentId || '',
        departmentName: userData.departmentName || '',
        position: userData.position || '',
        hireDate: userData.hireDate || new Date().toISOString().split('T')[0],
        roles: userData.roles || [],
        status: 'active',
        lastLoginTime: null,
        createdAt: getCurrentTime(),
        updatedAt: getCurrentTime(),
        password,
        isFirstLogin: true,
      }

      existingUsers.push(newUser)
      successCount++
    })

    storage.setUsers(existingUsers)
    set({ users: existingUsers })

    addLog({
      userId: currentUser?.id || '',
      userName: currentUser?.name || '系统',
      action: '批量导入',
      targetType: 'user',
      targetId: null,
      targetName: null,
      detail: `批量导入用户：成功 ${successCount} 条，失败 ${failedCount} 条`,
      ip: '127.0.0.1',
    })

    return { success: successCount, failed: failedCount, errors }
  },

  exportUsers: (filters) => {
    const { searchUsers } = get()
    const result = searchUsers({
      ...filters,
      page: 1,
      pageSize: 10000,
    })
    return result.data
  },

  addLog: (log) => {
    const { logs } = get()
    const newLog: OperationLog = {
      id: generateId(),
      userId: log.userId || '',
      userName: log.userName || '',
      action: log.action || '',
      targetType: log.targetType || '',
      targetId: log.targetId || null,
      targetName: log.targetName || null,
      detail: log.detail || '',
      ip: log.ip || '127.0.0.1',
      createdAt: getCurrentTime(),
    }
    const updatedLogs = [newLog, ...logs]
    storage.setLogs(updatedLogs)
    set({ logs: updatedLogs })
  },

  getVisiblePhone: (userId) => {
    const { users, currentUser } = get()
    const user = users.find((u) => u.id === userId)
    if (!user) return '-'

    if (currentUser?.isSuperAdmin) {
      return user.phone
    }

    if (currentUser) {
      const currentDeptIds = getChildDepartmentIds(currentUser.departmentId, get().departments)
      if (currentDeptIds.includes(user.departmentId)) {
        return user.phone
      }
    }

    return user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  },

  hasPermission: (menuId, action) => {
    const { currentUser, roles } = get()
    if (!currentUser) return false

    if (currentUser.isSuperAdmin) return true

    const userRoles = roles.filter((r) => currentUser.roles.includes(r.id))
    for (const role of userRoles) {
      const menuPerm = role.menuPermissions.find((m) => m.menuId === menuId)
      if (menuPerm && menuPerm[action]) {
        return true
      }
    }

    return false
  },
}))
