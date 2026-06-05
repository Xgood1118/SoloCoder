import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, runSql } from '../database.js';
import type { User } from '../../shared/types.js';

interface UserRow {
  id: string;
  username: string;
  password: string;
  role: string;
  enabled: number;
  lastLoginAt: string | null;
  createdAt: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    role: row.role as User['role'],
    enabled: row.enabled === 1,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

export function findAll(): User[] {
  const rows = queryAll<UserRow>(
    'SELECT id, username, password, role, enabled, last_login_at, created_at FROM users ORDER BY created_at DESC'
  );
  return rows.map(toUser);
}

export function findById(id: string): User | null {
  const row = queryOne<UserRow>(
    'SELECT id, username, password, role, enabled, last_login_at, created_at FROM users WHERE id = ?',
    [id]
  );
  return row ? toUser(row) : null;
}

export function findByUsername(username: string): User | null {
  const row = queryOne<UserRow>(
    'SELECT id, username, password, role, enabled, last_login_at, created_at FROM users WHERE username = ?',
    [username]
  );
  return row ? toUser(row) : null;
}

export function create(username: string, password: string, role: 'user' | 'admin' = 'user'): User {
  const id = uuidv4();
  const now = new Date().toISOString();
  runSql(
    'INSERT INTO users (id, username, password, role, enabled, last_login_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, username, password, role, 1, null, now]
  );
  return { id, username, password, role, enabled: true, lastLoginAt: null, createdAt: now };
}

export function updatePassword(id: string, password: string): void {
  runSql('UPDATE users SET password = ? WHERE id = ?', [password, id]);
}

export function updateEnabled(id: string, enabled: boolean): void {
  runSql('UPDATE users SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}

export function updateLastLogin(id: string): void {
  const now = new Date().toISOString();
  runSql('UPDATE users SET last_login_at = ? WHERE id = ?', [now, id]);
}

export function remove(id: string): void {
  runSql('DELETE FROM users WHERE id = ?', [id]);
}
