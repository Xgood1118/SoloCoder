import initSqlJs, { type Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

let dbInstance: Database | null = null;
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'chatbot.db');

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export async function initDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(buffer);
  } else {
    dbInstance = new SQL.Database();
  }
  runSchema(dbInstance);
  seedData(dbInstance);
  saveDb();
  return dbInstance;
}

export function getDb(): Database {
  if (!dbInstance) throw new Error('Database not initialized. Call initDb() first.');
  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export function queryAll<T>(sql: string, params: (string | number | null | boolean)[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    const obj = stmt.getAsObject();
    const camelObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      camelObj[toCamelCase(key)] = value;
    }
    results.push(camelObj as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T>(sql: string, params: (string | number | null | boolean)[] = []): T | null {
  const results = queryAll<T>(sql, params);
  return results[0] ?? null;
}

export function runSql(sql: string, params: (string | number | null | boolean)[] = []): number {
  const db = getDb();
  db.run(sql, params);
  saveDb();
  return db.getRowsModified();
}

function runSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      enabled INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '新会话',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      intent TEXT,
      sensitive_warning TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
  db.run(`
    CREATE TABLE IF NOT EXISTS knowledge_docs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '通用',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      indexed INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      keywords TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id ON knowledge_chunks(doc_id)');
  db.run(`
    CREATE TABLE IF NOT EXISTS sensitive_words (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL UNIQUE,
      level TEXT NOT NULL CHECK(level IN ('low', 'medium', 'high')),
      category TEXT NOT NULL DEFAULT '通用',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function seedData(db: Database): void {
  const existing = db.exec("SELECT COUNT(*) FROM sensitive_words");
  if (existing[0]?.values[0]?.[0] !== 0) return;

  db.run("INSERT INTO sensitive_words (id, word, level, category) VALUES ('sw-001', '机密', 'high', '保密')");
  db.run("INSERT INTO sensitive_words (id, word, level, category) VALUES ('sw-002', '绝密', 'high', '保密')");
  db.run("INSERT INTO sensitive_words (id, word, level, category) VALUES ('sw-003', '内部文件', 'medium', '保密')");
  db.run("INSERT INTO sensitive_words (id, word, level, category) VALUES ('sw-004', '未公开', 'medium', '保密')");
  db.run("INSERT INTO sensitive_words (id, word, level, category) VALUES ('sw-005', '竞争对手', 'low', '商业')");

  db.run("INSERT INTO knowledge_docs (id, title, content, category, indexed) VALUES ('kd-001', '公司请假流程', '请假流程：1. 登录OA系统 2. 选择请假类型（年假/事假/病假）3. 填写请假起止日期和原因 4. 提交给直属领导审批 5. 审批通过后生效。年假最少提前3天申请，事假和病假可当天申请。', '人事行政', 1)");
  db.run("INSERT INTO knowledge_docs (id, title, content, category, indexed) VALUES ('kd-002', 'IT设备申请流程', 'IT设备申请流程：1. 在IT服务台提交设备申请工单 2. 选择设备类型（笔记本/显示器/键鼠等）3. 填写申请理由 4. 部门经理审批 5. IT部门采购 6. 到货后通知领取。一般处理周期为5-7个工作日。', 'IT支持', 1)");

  db.run("INSERT INTO knowledge_chunks (id, doc_id, content, keywords) VALUES ('kc-001', 'kd-001', '请假流程：1. 登录OA系统 2. 选择请假类型（年假/事假/病假）3. 填写请假起止日期和原因 4. 提交给直属领导审批 5. 审批通过后生效。年假最少提前3天申请，事假和病假可当天申请。', '请假,流程,年假,事假,病假,OA,审批')");
  db.run("INSERT INTO knowledge_chunks (id, doc_id, content, keywords) VALUES ('kc-002', 'kd-002', 'IT设备申请流程：1. 在IT服务台提交设备申请工单 2. 选择设备类型（笔记本/显示器/键鼠等）3. 填写申请理由 4. 部门经理审批 5. IT部门采购 6. 到货后通知领取。一般处理周期为5-7个工作日。', 'IT设备,申请,工单,笔记本,显示器,采购')");
}
