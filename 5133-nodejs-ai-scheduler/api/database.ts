import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import fs from 'fs'
import path from 'path'

let db: Database | null = null
let SQL: SqlJsStatic | null = null
const projectRoot = process.cwd()
const dataDir = path.join(projectRoot, 'data')
const dbPath = path.join(dataDir, 'scheduler.db')
const wasmPath = path.join(projectRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

function persistDatabase() {
  if (!db) return
  try {
    const data = db.export()
    fs.writeFileSync(dbPath, data)
  } catch (e) {
    console.error('Failed to persist database:', e)
  }
}

export async function getDatabase(): Promise<Database> {
  if (db && SQL) return db

  ensureDataDir()

  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => wasmPath
    })
  }

  if (!db) {
    let buffer: Buffer | null = null
    if (fs.existsSync(dbPath)) {
      buffer = fs.readFileSync(dbPath)
    }
    db = new SQL.Database(buffer)
  }

  initTables(db)
  insertDefaultConfig(db)
  persistDatabase()

  return db
}

export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results: T[] = []
  const columnNames = stmt.getColumnNames()
  while (stmt.step()) {
    const row = stmt.get()
    const obj: Record<string, unknown> = {}
    columnNames.forEach((name, idx) => {
      obj[name] = row[idx]
    })
    results.push(obj as T)
  }
  stmt.free()
  return results
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const results = queryAll<T>(sql, params)
  return results.length > 0 ? results[0] : null
}

export function run(sql: string, params: unknown[] = []): void {
  if (!db) throw new Error('Database not initialized')
  db.run(sql, params)
  persistDatabase()
}

export function runBatch(statements: Array<{ sql: string; params?: unknown[] }>): void {
  if (!db) throw new Error('Database not initialized')
  statements.forEach(({ sql, params = [] }) => {
    db!.run(sql, params)
  })
  persistDatabase()
}

function initTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('once', 'cron', 'interval')),
      cron_expression TEXT,
      interval_seconds INTEGER,
      executor_type TEXT NOT NULL CHECK(executor_type IN ('script', 'http')),
      script_path TEXT,
      http_url TEXT,
      http_method TEXT DEFAULT 'GET',
      http_headers TEXT DEFAULT '{}',
      http_body TEXT,
      parameters TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      retry_policy TEXT DEFAULT '{"maxRetries":3,"retryIntervalMs":60000,"retryStrategy":"fixed","exponentialBase":2}',
      timeout_policy TEXT DEFAULT '{"warnTimeoutMs":300000,"forceTimeoutMs":1800000,"onWarnAction":"alert","onForceAction":"kill_and_fail"}',
      alert_policy TEXT DEFAULT '{"channels":["webhook"],"webhookUrls":[],"emailRecipients":[],"onTimeout":true,"onFailure":true,"onRetry":false}',
      created_by TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(task_id, depends_on_task_id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS execution_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      task_name TEXT NOT NULL,
      trigger_time TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      status TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed', 'timeout', 'skipped')),
      exit_code INTEGER,
      output TEXT DEFAULT '',
      error TEXT DEFAULT '',
      retry_count INTEGER DEFAULT 0,
      is_retry INTEGER DEFAULT 0,
      duration_ms INTEGER
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS alert_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      execution_id TEXT REFERENCES execution_records(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK(type IN ('timeout_warn', 'timeout_force', 'failure', 'retry', 'dependency_failed')),
      message TEXT NOT NULL,
      channels TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'acknowledged')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notification_channels (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('webhook', 'email')),
      name TEXT NOT NULL,
      webhook_url TEXT,
      email_smtp_host TEXT,
      email_smtp_port INTEGER,
      email_user TEXT,
      email_pass TEXT,
      email_from TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type)')
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON tasks(enabled)')
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_records_task_id ON execution_records(task_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_records_status ON execution_records(status)')
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_records_trigger_time ON execution_records(trigger_time)')
  db.run('CREATE INDEX IF NOT EXISTS idx_alert_records_task_id ON alert_records(task_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_alert_records_status ON alert_records(status)')
  db.run('CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends ON task_dependencies(depends_on_task_id)')
}

function insertDefaultConfig(db: Database) {
  const defaults: Array<[string, string]> = [
    ['defaultTimeoutPolicy', '{"warnTimeoutMs":300000,"forceTimeoutMs":1800000,"onWarnAction":"alert","onForceAction":"kill_and_fail"}'],
    ['defaultRetryPolicy', '{"maxRetries":3,"retryIntervalMs":60000,"retryStrategy":"fixed","exponentialBase":2}'],
    ['maxConcurrentTasks', '10']
  ]
  defaults.forEach(([key, value]) => {
    const existing = db.exec(`SELECT 1 FROM system_config WHERE key = ?`, [key])
    if (existing.length === 0 || existing[0].values.length === 0) {
      db.run(`INSERT INTO system_config (key, value) VALUES (?, ?)`, [key, value])
    }
  })
}
