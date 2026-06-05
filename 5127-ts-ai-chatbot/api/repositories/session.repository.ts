import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, runSql } from '../database.js';
import type { Session } from '../../shared/types.js';

export function create(userId: string, title: string): Session {
  const id = uuidv4();
  const now = new Date().toISOString();
  runSql(
    'INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, userId, title, now, now]
  );
  return { id, userId, title, createdAt: now, updatedAt: now };
}

export function findByUserId(userId: string): Session[] {
  return queryAll<Session>(
    'SELECT id, user_id, title, created_at, updated_at FROM sessions WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
}

export function findById(id: string): Session | null {
  return queryOne<Session>(
    'SELECT id, user_id, title, created_at, updated_at FROM sessions WHERE id = ?',
    [id]
  );
}

export function updateTitle(id: string, title: string): Session | null {
  const now = new Date().toISOString();
  runSql(
    'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?',
    [title, now, id]
  );
  return findById(id);
}

export function remove(id: string): boolean {
  return runSql('DELETE FROM sessions WHERE id = ?', [id]) > 0;
}
