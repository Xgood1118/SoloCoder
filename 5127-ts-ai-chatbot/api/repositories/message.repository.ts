import { v4 as uuidv4 } from 'uuid';
import { queryAll, runSql } from '../database.js';
import type { Message, IntentType } from '../../shared/types.js';

interface MessageRow {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  intent: string | null;
  sensitiveWarning: string | null;
  createdAt: string;
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as Message['role'],
    content: row.content,
    intent: (row.intent as IntentType) || undefined,
    sensitiveWarning: row.sensitiveWarning || undefined,
    createdAt: row.createdAt,
  };
}

export function create(
  sessionId: string,
  role: Message['role'],
  content: string,
  intent?: IntentType,
  sensitiveWarning?: string
): Message {
  const id = uuidv4();
  const now = new Date().toISOString();
  runSql(
    'INSERT INTO messages (id, session_id, role, content, intent, sensitive_warning, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, sessionId, role, content, intent ?? null, sensitiveWarning ?? null, now]
  );
  return { id, sessionId, role, content, intent, sensitiveWarning, createdAt: now };
}

export function findBySessionId(sessionId: string): Message[] {
  const rows = queryAll<MessageRow>(
    'SELECT id, session_id, role, content, intent, sensitive_warning, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );
  return rows.map(toMessage);
}

export function findRecentBySessionId(sessionId: string, limit: number): Message[] {
  const rows = queryAll<MessageRow>(
    'SELECT id, session_id, role, content, intent, sensitive_warning, created_at FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?',
    [sessionId, limit]
  );
  return rows.reverse().map(toMessage);
}

export function searchByContent(query: string): Message[] {
  const rows = queryAll<MessageRow>(
    'SELECT id, session_id, role, content, intent, sensitive_warning, created_at FROM messages WHERE content LIKE ? ORDER BY created_at DESC',
    [`%${query}%`]
  );
  return rows.map(toMessage);
}

export function findByIds(messageIds: string[]): Message[] {
  if (messageIds.length === 0) return [];
  const placeholders = messageIds.map(() => '?').join(',');
  const rows = queryAll<MessageRow>(
    `SELECT id, session_id, role, content, intent, sensitive_warning, created_at FROM messages WHERE id IN (${placeholders}) ORDER BY created_at ASC`,
    messageIds
  );
  return rows.map(toMessage);
}

export function copyToSession(messageIds: string[], targetSessionId: string): boolean {
  const messages = findByIds(messageIds);
  if (messages.length === 0) return false;
  const now = new Date().toISOString();
  for (const msg of messages) {
    const id = uuidv4();
    runSql(
      'INSERT INTO messages (id, session_id, role, content, intent, sensitive_warning, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, targetSessionId, msg.role, msg.content, msg.intent ?? null, msg.sensitiveWarning ?? null, now]
    );
  }
  return true;
}
