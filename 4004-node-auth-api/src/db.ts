import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'auth.db');
  const dir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(path.resolve(dbPath));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES menus(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      path TEXT,
      icon TEXT,
      sort INTEGER NOT NULL DEFAULT 0,
      permission_code TEXT,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      email TEXT,
      phone TEXT,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active',
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      password_changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_fingerprint TEXT NOT NULL,
      device_type TEXT,
      ip TEXT,
      location TEXT,
      token_jti TEXT NOT NULL,
      token_expires_at TEXT NOT NULL,
      refresh_jti TEXT NOT NULL,
      refresh_expires_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, device_fingerprint)
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT,
      ip TEXT,
      device_type TEXT,
      device_model TEXT,
      os TEXT,
      browser TEXT,
      location TEXT,
      status TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS token_blacklist (
      jti TEXT PRIMARY KEY,
      user_id INTEGER,
      token_type TEXT NOT NULL,
      reason TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_logs_time ON login_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON token_blacklist(expires_at);
  `);
}

export interface SqliteRow {
  [key: string]: unknown;
}

export function queryOne<T = SqliteRow>(sql: string, params: unknown[] = []): T | null {
  return (getDb().prepare(sql).get(...params) as T | null) ?? null;
}

export function queryAll<T = SqliteRow>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function execute(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number | bigint } {
  const info = getDb().prepare(sql).run(...params);
  return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

export function inTx<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
