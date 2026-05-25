import { v4 as uuidv4 } from 'uuid';
import { execute, getDb, inTx, queryAll, queryOne } from './db';
import { LoginLogRecord, SessionRecord } from './types';

export function getSessionById(id: string): SessionRecord | null {
  return queryOne<SessionRecord>(`SELECT * FROM sessions WHERE id = ?`, [id]);
}

export function getActiveSessionsByUser(userId: number): SessionRecord[] {
  return queryAll<SessionRecord>(
    `SELECT * FROM sessions WHERE user_id = ? AND datetime(token_expires_at) > datetime('now') ORDER BY last_active_at DESC`,
    [userId]
  );
}

export function upsertSession(params: {
  user_id: number;
  device_fingerprint: string;
  device_type: string | null;
  ip: string | null;
  location: string | null;
  token_jti: string;
  token_expires_at: string;
  refresh_jti: string;
  refresh_expires_at: string;
}): { id: string; version: number; isNew: boolean; previous: SessionRecord | null } {
  return inTx(() => {
    const existing = queryOne<SessionRecord>(
      `SELECT * FROM sessions WHERE user_id = ? AND device_fingerprint = ?`,
      [params.user_id, params.device_fingerprint]
    );

    if (existing) {
      const newVersion = existing.version + 1;
      const id = existing.id;
      execute(
        `UPDATE sessions SET
           device_type = ?, ip = ?, location = ?,
           token_jti = ?, token_expires_at = ?,
           refresh_jti = ?, refresh_expires_at = ?,
           version = ?, last_active_at = datetime('now')
         WHERE id = ? AND version = ?`,
        [
          params.device_type,
          params.ip,
          params.location,
          params.token_jti,
          params.token_expires_at,
          params.refresh_jti,
          params.refresh_expires_at,
          newVersion,
          id,
          existing.version,
        ]
      );
      const updated = getSessionById(id);
      if (!updated || updated.version !== newVersion) {
        throw new Error('SESSION_VERSION_CONFLICT');
      }
      return { id, version: newVersion, isNew: false, previous: existing };
    }

    const id = uuidv4();
    execute(
      `INSERT INTO sessions
         (id, user_id, device_fingerprint, device_type, ip, location,
          token_jti, token_expires_at, refresh_jti, refresh_expires_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        params.user_id,
        params.device_fingerprint,
        params.device_type,
        params.ip,
        params.location,
        params.token_jti,
        params.token_expires_at,
        params.refresh_jti,
        params.refresh_expires_at,
      ]
    );
    return { id, version: 1, isNew: true, previous: null };
  });
}

export function refreshSessionTokens(
  sessionId: string,
  currentVersion: number,
  params: {
    token_jti: string;
    token_expires_at: string;
    refresh_jti: string;
    refresh_expires_at: string;
    ip?: string | null;
  }
): { version: number } {
  const nextVersion = currentVersion + 1;
  const info = getDb().prepare(
    `UPDATE sessions SET
       token_jti = ?, token_expires_at = ?,
       refresh_jti = ?, refresh_expires_at = ?,
       version = ?, last_active_at = datetime('now'),
       ip = COALESCE(?, ip)
     WHERE id = ? AND version = ?`
  ).run(
    params.token_jti,
    params.token_expires_at,
    params.refresh_jti,
    params.refresh_expires_at,
    nextVersion,
    params.ip ?? null,
    sessionId,
    currentVersion
  );
  if (info.changes === 0) {
    throw new Error('SESSION_VERSION_CONFLICT');
  }
  return { version: nextVersion };
}

export function deleteSession(id: string): number {
  const info = execute(`DELETE FROM sessions WHERE id = ?`, [id]);
  return info.changes;
}

export function deleteSessionsByUser(userId: number, exceptId?: string): number {
  if (exceptId) {
    const info = execute(`DELETE FROM sessions WHERE user_id = ? AND id <> ?`, [userId, exceptId]);
    return info.changes;
  }
  const info = execute(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
  return info.changes;
}

export function blacklistToken(params: {
  jti: string;
  user_id: number | null;
  token_type: 'access' | 'refresh';
  reason: string;
  expires_at: string;
}): void {
  execute(
    `INSERT OR IGNORE INTO token_blacklist (jti, user_id, token_type, reason, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [params.jti, params.user_id, params.token_type, params.reason, params.expires_at]
  );
}

export function isTokenBlacklisted(jti: string): boolean {
  const row = queryOne<{ jti: string }>(
    `SELECT jti FROM token_blacklist WHERE jti = ? AND datetime(expires_at) > datetime('now')`,
    [jti]
  );
  return !!row;
}

export function cleanupExpiredBlacklist(): number {
  const info = execute(`DELETE FROM token_blacklist WHERE datetime(expires_at) <= datetime('now')`);
  return info.changes;
}

export function createLoginLog(params: {
  user_id: number | null;
  username: string | null;
  ip: string | null;
  device_type: string | null;
  device_model: string | null;
  os: string | null;
  browser: string | null;
  location: string | null;
  status: 'success' | 'failure';
  reason: string | null;
}): { id: number } {
  const info = execute(
    `INSERT INTO login_logs
       (user_id, username, ip, device_type, device_model, os, browser, location, status, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.user_id,
      params.username,
      params.ip,
      params.device_type,
      params.device_model,
      params.os,
      params.browser,
      params.location,
      params.status,
      params.reason,
    ]
  );
  return { id: Number(info.lastInsertRowid) };
}

export function listLoginLogs(userId: number, limit: number = 20): LoginLogRecord[] {
  return queryAll<LoginLogRecord>(
    `SELECT * FROM login_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
}
