import { create } from 'zustand'
import { Role, MenuPermission, DataPermission } from '../types'
import { storage } from '../utils/storage'
import { generateId, getCurrentTime } from '../utils/helpers'

interface RoleState {
  roles: Role[]
  loadData: () => void
  getRoleById: (id: string) => Role | undefined
  addRole: (role: Partial<Role>) => { success: boolean; message: string }
  updateRole: (id: string, role: Partial<Role>) => { success: boolean; message: string }
  deleteRole: (id: string) => { success: boolean; message: string }
  updateMenuPermission: (roleId: string, menuId: string, action: keyof MenuPermission, value: boolean) => void
  updateDataPermission: (roleId: string, dataPermission: DataPermission) => void
}

const defaultMenuPermissions: MenuPermission[] = [
  { menuId: 'user', menuName: '用户管理', canView: false, canAdd: false, canEdit: false, canDelete: false },
  { menuId: 'department', menuName: '部门管理', canView: false, canAdd: false, canEdit: false, canDelete: false },
  { menuId: 'role', menuName: '角色管理', canView: false, canAdd: false, canEdit: false, canDelete: false },
  { menuId: 'permission', menuName: '权限配置', canView: false, canAdd: false, canEdit: false, canDelete: false },
  { menuId: 'log', menuName: '操作日志', canView: false, canAdd: false, canEdit: false, canDelete: false },
]

export const useRoleStore = create<RoleState>((set, get) => ({
  roles: [],

  loadData: () => {
    const roles = storage.getRoles() || []
    set({ roles })
  },

  getRoleById: (id) => {
    return get().roles.find((r) => r.id === id)
  },

  addRole: (role) => {
    const { roles } = get()

    const existing = roles.find((r) => r.code === role.code)
    if (existing) {
      return { success: false, message: '角色编码已存在' }
    }

    const newRole: Role = {
      id: generateId(),
      name: role.name || '',
      code: role.code || '',
      description: role.description || '',
      isSystem: false,
      menuPermissions: role.menuPermissions || defaultMenuPermissions.map((p) => ({ ...p })),
      dataPermissions: role.dataPermissions || { type: 'self', departmentIds: [] },
    }

    const updated = [...roles, newRole]
    storage.setRoles(updated)
    set({ roles: updated })

    return { success: true, message: '角色创建成功' }
  },

  updateRole: (id, role) => {
    const { roles } = get()

    const index = roles.findIndex((r) => r.id === id)
    if (index === -1) {
      return { success: false, message: '角色不存在' }
    }

    if (roles[index].isSystem) {
      return { success: false, message: '系统角色不允许修改' }
    }

    const updated = { ...roles[index], ...role }
    const updatedList = [...roles]
    updatedList[index] = updated
    storage.setRoles(updatedList)
    set({ roles: updatedList })

    return { success: true, message: '角色更新成功' }
  },

  deleteRole: (id) => {
    const { roles } = get()

    const role = roles.find((r) => r.id === id)
    if (!role) {
      return { success: false, message: '角色不存在' }
    }

    if (role.isSystem) {
      return { success: false, message: '系统角色不允许删除' }
    }

    const users = storage.getUsers() || []
    const hasUser = users.some((u: any) => u.roles.includes(id))
    if (hasUser) {
      return { success: false, message: '该角色已分配给用户，无法删除' }
    }

    const updated = roles.filter((r) => r.id !== id)
    storage.setRoles(updated)
    set({ roles: updated })

    return { success: true, message: '角色删除成功' }
  },

  updateMenuPermission: (roleId, menuId, action, value) => {
    const { roles } = get()

    const updatedRoles = roles.map((role) => {
      if (role.id !== roleId) return role

      const menuPermissions = role.menuPermissions.map((perm) => {
        if (perm.menuId !== menuId) return perm
        return { ...perm, [action]: value }
      })

      return { ...role, menuPermissions }
    })

    storage.setRoles(updatedRoles)
    set({ roles: updatedRoles })
  },

  updateDataPermission: (roleId, dataPermission) => {
    const { roles } = get()

    const updatedRoles = roles.map((role) => {
      if (role.id !== roleId) return role
      return { ...role, dataPermissions: dataPermission }
    })

    storage.setRoles(updatedRoles)
    set({ roles: updatedRoles })
  },
}))
