import { create } from 'zustand'
import { Department, User } from '../types'
import { storage } from '../utils/storage'
import { generateId, getCurrentTime, hasCircularReference } from '../utils/helpers'

interface DepartmentState {
  departments: Department[]
  users: User[]
  loadData: () => void
  getDepartmentTree: () => Department[]
  getDepartmentPath: (departmentId: string) => string[]
  getChildDepartmentIds: (departmentId: string) => string[]
  getDepartmentUsers: (departmentId: string) => User[]
  getDepartmentQuota: (departmentId: string) => { quota: number; actual: number; isOverQuota: boolean }
  addDepartment: (dept: Partial<Department>) => { success: boolean; message: string }
  updateDepartment: (id: string, dept: Partial<Department>) => { success: boolean; message: string }
  deleteDepartment: (id: string) => { success: boolean; message: string }
  moveDepartment: (id: string, newParentId: string | null) => { success: boolean; message: string }
  checkOverQuota: (departmentId: string) => boolean
}

export const useDepartmentStore = create<DepartmentState>((set, get) => ({
  departments: [],
  users: [],

  loadData: () => {
    const departments = storage.getDepartments() || []
    const users = storage.getUsers() || []
    set({ departments, users })
  },

  getDepartmentTree: () => {
    const { departments } = get()
    const flatDepts = [...departments]

    const buildTree = (items: Department[], parentId: string | null): Department[] => {
      return items
        .filter((d) => d.parentId === parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((dept) => {
          const children = buildTree(items, dept.id)
          return {
            ...dept,
            children,
            userCount: get().getDepartmentUsers(dept.id).length,
          }
        })
    }

    return buildTree(flatDepts, null)
  },

  getDepartmentPath: (departmentId: string) => {
    const { departments } = get()
    const path: string[] = []
    let currentId = departmentId

    while (currentId) {
      const dept = departments.find((d) => d.id === currentId)
      if (!dept) break
      path.unshift(dept.name)
      currentId = dept.parentId || ''
    }

    return path
  },

  getChildDepartmentIds: (departmentId: string) => {
    const { departments } = get()
    const ids: string[] = [departmentId]

    const findChildren = (parentId: string) => {
      departments
        .filter((d) => d.parentId === parentId)
        .forEach((child) => {
          ids.push(child.id)
          findChildren(child.id)
        })
    }

    findChildren(departmentId)
    return ids
  },

  getDepartmentUsers: (departmentId: string) => {
    const { users } = get()
    const childIds = get().getChildDepartmentIds(departmentId)
    return users.filter((u) => childIds.includes(u.departmentId) && u.status === 'active')
  },

  getDepartmentQuota: (departmentId: string) => {
    const { departments } = get()
    const dept = departments.find((d) => d.id === departmentId)
    if (!dept) {
      return { quota: 0, actual: 0, isOverQuota: false }
    }

    const users = get().getDepartmentUsers(departmentId)
    return {
      quota: dept.quota,
      actual: users.length,
      isOverQuota: users.length > dept.quota,
    }
  },

  addDepartment: (dept) => {
    const { departments } = get()

    const existing = departments.find(
      (d) => d.name === dept.name && d.parentId === dept.parentId
    )
    if (existing) {
      return { success: false, message: '同级部门中已存在同名部门' }
    }

    const newDept: Department = {
      id: generateId(),
      name: dept.name || '',
      parentId: dept.parentId || null,
      leaderId: dept.leaderId || null,
      leaderName: dept.leaderName || null,
      quota: dept.quota || 10,
      sortOrder: dept.sortOrder || 1,
    }

    const updated = [...departments, newDept]
    storage.setDepartments(updated)
    set({ departments: updated })

    return { success: true, message: '部门创建成功' }
  },

  updateDepartment: (id, dept) => {
    const { departments } = get()

    const index = departments.findIndex((d) => d.id === id)
    if (index === -1) {
      return { success: false, message: '部门不存在' }
    }

    const updated = { ...departments[index], ...dept }
    const updatedList = [...departments]
    updatedList[index] = updated
    storage.setDepartments(updatedList)
    set({ departments: updatedList })

    return { success: true, message: '部门更新成功' }
  },

  deleteDepartment: (id) => {
    const { departments, users } = get()

    const hasChildren = departments.some((d) => d.parentId === id)
    if (hasChildren) {
      return { success: false, message: '该部门存在子部门，无法删除' }
    }

    const hasUsers = users.some((u) => u.departmentId === id && u.status === 'active')
    if (hasUsers) {
      return { success: false, message: '该部门存在在职员工，无法删除' }
    }

    const updated = departments.filter((d) => d.id !== id)
    storage.setDepartments(updated)
    set({ departments: updated })

    return { success: true, message: '部门删除成功' }
  },

  moveDepartment: (id, newParentId) => {
    const { departments } = get()

    if (newParentId) {
      if (hasCircularReference(id, newParentId, departments)) {
        return { success: false, message: '不能将部门移动到其下级部门' }
      }
    }

    const index = departments.findIndex((d) => d.id === id)
    if (index === -1) {
      return { success: false, message: '部门不存在' }
    }

    const updated = { ...departments[index], parentId: newParentId }
    const updatedList = [...departments]
    updatedList[index] = updated
    storage.setDepartments(updatedList)
    set({ departments: updatedList })

    return { success: true, message: '部门移动成功' }
  },

  checkOverQuota: (departmentId) => {
    const { isOverQuota } = get().getDepartmentQuota(departmentId)
    return isOverQuota
  },
}))
