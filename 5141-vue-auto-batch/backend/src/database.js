const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new sqlite3.Database(dbPath);

db.run = function (sql, ...params) {
  return new Promise((resolve, reject) => {
    db.constructor.prototype.run.call(db, sql, ...params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

db.get = promisify(db.get);
db.all = promisify(db.all);
db.exec = promisify(db.exec);

async function initDB() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS directories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_pattern TEXT NOT NULL,
      min_size INTEGER DEFAULT 0,
      max_size INTEGER,
      start_time TEXT,
      end_time TEXT,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rule_relation (
      id INTEGER PRIMARY KEY,
      relation TEXT DEFAULT 'any' CHECK(relation IN ('all', 'any'))
    );

    INSERT OR IGNORE INTO rule_relation (id, relation) VALUES (1, 'any');

    CREATE TABLE IF NOT EXISTS processing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      result TEXT NOT NULL,
      reason TEXT,
      duration_ms INTEGER,
      rule_name TEXT,
      retry_count INTEGER DEFAULT 0,
      md5 TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deduplication (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      md5 TEXT NOT NULL UNIQUE,
      file_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS retry_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      rule_name TEXT,
      retry_remaining INTEGER NOT NULL,
      next_retry_at DATETIME NOT NULL,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO app_settings (key, value) VALUES 
      ('max_retries', '3'),
      ('retry_interval', '30'),
      ('target_directory', ''),
      ('processing_steps', '[]'),
      ('queue_max_size', '100'),
      ('worker_threads', '4'),
      ('retention_days', '30'),
      ('dedup_retention_days', '30');

    CREATE INDEX IF NOT EXISTS idx_records_created ON processing_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_records_result ON processing_records(result);
    CREATE INDEX IF NOT EXISTS idx_dedup_created ON deduplication(created_at);
    CREATE INDEX IF NOT EXISTS idx_retry_next ON retry_queue(next_retry_at);
  `);
}

async function cleanupOldData() {
  try {
    const retentionRow = await db.get('SELECT value FROM app_settings WHERE key = ?', 'retention_days');
    const dedupRow = await db.get('SELECT value FROM app_settings WHERE key = ?', 'dedup_retention_days');
    const retentionDays = parseInt(retentionRow?.value || '30', 10);
    const dedupDays = parseInt(dedupRow?.value || '30', 10);

    await db.run(`
      DELETE FROM processing_records
      WHERE created_at < datetime('now', ?)
    `, `-${retentionDays} days`);

    await db.run(`
      DELETE FROM deduplication
      WHERE created_at < datetime('now', ?)
    `, `-${dedupDays} days`);
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}

function prepare(sql) {
  const stmt = db.prepare(sql);
  const originalRun = stmt.run.bind(stmt);
  stmt.run = function (...params) {
    return new Promise((resolve, reject) => {
      originalRun(...params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  };
  stmt.get = promisify(stmt.get);
  stmt.all = promisify(stmt.all);
  return stmt;
}

initDB().then(() => {
  console.log('Database initialized');
}).catch((err) => {
  console.error('Database init error:', err);
});

setInterval(cleanupOldData, 60 * 60 * 1000);

module.exports = { db, cleanupOldData, prepare };
