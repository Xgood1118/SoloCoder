export interface AuthenticatedUser {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  department_id: number | null;
  roles: string[];
}

export interface UserRecord {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  department_id: number | null;
  status: string;
  failed_attempts: number;
  locked_until: string | null;
  password_changed_at: string;
  must_change_password: number;
  created_at: string;
  updated_at: string;
}

export interface RoleRecord {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system: number;
}

export interface DepartmentRecord {
  id: number;
  parent_id: number | null;
  name: string;
  path: string;
  level: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface MenuRecord {
  id: number;
  parent_id: number | null;
  name: string;
  path: string | null;
  icon: string | null;
  sort: number;
  permission_code: string | null;
  is_visible: number;
}

export interface SessionRecord {
  id: string;
  user_id: number;
  device_fingerprint: string;
  device_type: string | null;
  ip: string | null;
  location: string | null;
  token_jti: string;
  token_expires_at: string;
  refresh_jti: string;
  refresh_expires_at: string;
  version: number;
  created_at: string;
  last_active_at: string;
}

export interface LoginLogRecord {
  id: number;
  user_id: number | null;
  username: string | null;
  ip: string | null;
  device_type: string | null;
  device_model: string | null;
  os: string | null;
  browser: string | null;
  location: string | null;
  status: string;
  reason: string | null;
  created_at: string;
}
