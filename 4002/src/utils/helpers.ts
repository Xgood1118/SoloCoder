import { User, Department, Role, OperationLog } from '../types'

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const generatePassword = (length = 8): string => {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789!@#$'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export const generateEmployeeId = (): string => {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `${year}${random}`
}

export const getCurrentTime = (): string => {
  return new Date().toISOString()
}

export const formatDate = (date: string | null): string => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

export const formatDateTime = (date: string | null): string => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

export const validatePhone = (phone: string): boolean => {
  return /^1[3-9]\d{9}$/.test(phone)
}

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const flattenDepartments = (
  departments: Department[]
): Department[] => {
  const result: Department[] = []
  const traverse = (items: Department[]) => {
    items.forEach((item) => {
      result.push(item)
      if (item.children && item.children.length > 0) {
        traverse(item.children)
      }
    })
  }
  traverse(departments)
  return result
}

export const getDepartmentPath = (
  departmentId: string,
  departments: Department[]
): string[] => {
  const path: string[] = []
  const findPath = (items: Department[], targetId: string): boolean => {
    for (const dept of items) {
      if (dept.id === targetId) {
        path.unshift(dept.name)
        return true
      }
      if (dept.children) {
        if (findPath(dept.children, targetId)) {
          return true
        }
      }
    }
    return false
  }
  findPath(departments, departmentId)
  return path
}

export const getChildDepartmentIds = (
  departmentId: string,
  departments: Department[]
): string[] => {
  const ids: string[] = [departmentId]
  const findChildren = (items: Department[]) => {
    items.forEach((item) => {
      if (item.id === departmentId) {
        const collectIds = (dept: Department) => {
          if (dept.children) {
            dept.children.forEach((child) => {
              ids.push(child.id)
              collectIds(child)
            })
          }
        }
        collectIds(item)
      } else if (item.children) {
        findChildren(item.children)
      }
    })
  }
  findChildren(departments)
  return ids
}

export const getParentDepartmentIds = (
  departmentId: string,
  departments: Department[]
): string[] => {
  const ids: string[] = []
  let currentId = departmentId
  const findParent = (items: Department[], id: string): string | null => {
    for (const item of items) {
      if (item.id === id) {
        return item.parentId
      }
      if (item.children) {
        const result = findParent(item.children, id)
        if (result !== null) {
          return result
        }
      }
    }
    return null
  }
  while (currentId) {
    const parentId = findParent(departments, currentId)
    if (parentId) {
      ids.push(parentId)
      currentId = parentId
    } else {
      break
    }
  }
  return ids
}

export const hasCircularReference = (
  departmentId: string,
  newParentId: string,
  departments: Department[]
): boolean => {
  const checkChildren = (items: Department[], id: string): boolean => {
    for (const item of items) {
      if (item.id === id) {
        return true
      }
      if (item.children) {
        if (checkChildren(item.children, id)) {
          return true
        }
      }
    }
    return false
  }
  const findDepartment = (items: Department[], id: string): Department | null => {
    for (const item of items) {
      if (item.id === id) {
        return item
      }
      if (item.children) {
        const found = findDepartment(item.children, id)
        if (found) return found
      }
    }
    return null
  }
  const targetDept = findDepartment(departments, departmentId)
  if (!targetDept) return false
  const isDescendant = checkChildren(targetDept.children || [], newParentId)
  return isDescendant
}

export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}
