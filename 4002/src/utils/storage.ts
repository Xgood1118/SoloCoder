const STORAGE_KEYS = {
  USERS: 'user_admin_users',
  DEPARTMENTS: 'user_admin_departments',
  ROLES: 'user_admin_roles',
  LOGS: 'user_admin_logs',
  CURRENT_USER: 'user_admin_current_user',
  COLUMN_CONFIG: 'user_admin_column_config',
}

export const storage = {
  getUsers: () => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS)
    return data ? JSON.parse(data) : null
  },
  setUsers: (users: any[]) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
  },
  getDepartments: () => {
    const data = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS)
    return data ? JSON.parse(data) : null
  },
  setDepartments: (departments: any[]) => {
    localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments))
  },
  getRoles: () => {
    const data = localStorage.getItem(STORAGE_KEYS.ROLES)
    return data ? JSON.parse(data) : null
  },
  setRoles: (roles: any[]) => {
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles))
  },
  getLogs: () => {
    const data = localStorage.getItem(STORAGE_KEYS.LOGS)
    return data ? JSON.parse(data) : []
  },
  setLogs: (logs: any[]) => {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))
  },
  getCurrentUser: () => {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
    return data ? JSON.parse(data) : null
  },
  setCurrentUser: (user: any) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user))
  },
  getColumnConfig: () => {
    const data = localStorage.getItem(STORAGE_KEYS.COLUMN_CONFIG)
    return data ? JSON.parse(data) : null
  },
  setColumnConfig: (config: any[]) => {
    localStorage.setItem(STORAGE_KEYS.COLUMN_CONFIG, JSON.stringify(config))
  },
  clear: () => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
  },
  exportConfig: () => {
    const config = {
      users: storage.getUsers(),
      departments: storage.getDepartments(),
      roles: storage.getRoles(),
    }
    return JSON.stringify(config, null, 2)
  },
  importConfig: (jsonString: string) => {
    try {
      const config = JSON.parse(jsonString)
      if (config.users) storage.setUsers(config.users)
      if (config.departments) storage.setDepartments(config.departments)
      if (config.roles) storage.setRoles(config.roles)
      return true
    } catch {
      return false
    }
  },
}
