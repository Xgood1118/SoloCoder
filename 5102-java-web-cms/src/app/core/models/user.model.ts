export type UserRole = 'admin' | 'contributor' | 'reader';

export interface User {
  id: string;
  username: string;
  realName: string;
  department: string;
  role: UserRole;
  email: string;
  avatar?: string;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
