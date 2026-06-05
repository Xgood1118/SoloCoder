-- Deploy Pipeline Management Platform - Initial Schema
-- This SQL is for reference; TypeORM handles actual schema via synchronize: true

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'submitter',
  active INTEGER NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
  updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS build_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repository TEXT NOT NULL,
  branch TEXT NOT NULL,
  commit TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  config TEXT,
  userId TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
  updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  description TEXT,
  credentials TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  serverHost TEXT,
  deployPath TEXT,
  createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
  updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deploy_requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  buildTaskId TEXT NOT NULL,
  environmentId TEXT NOT NULL,
  userId TEXT NOT NULL,
  deployConfig TEXT,
  createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
  updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (buildTaskId) REFERENCES build_tasks(id),
  FOREIGN KEY (environmentId) REFERENCES environments(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS approval_nodes (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  comment TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  deployRequestId TEXT NOT NULL,
  approverId TEXT,
  createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
  updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (deployRequestId) REFERENCES deploy_requests(id),
  FOREIGN KEY (approverId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS queue_items (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'waiting',
  priority INTEGER NOT NULL DEFAULT 0,
  dependencyIds TEXT NOT NULL DEFAULT '[]',
  deployRequestId TEXT NOT NULL,
  retryCount INTEGER NOT NULL DEFAULT 0,
  maxRetries INTEGER NOT NULL DEFAULT 3,
  errorMessage TEXT,
  createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
  updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (deployRequestId) REFERENCES deploy_requests(id)
);

CREATE TABLE IF NOT EXISTS rollback_requests (
  id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  targetVersion TEXT,
  deployRequestId TEXT NOT NULL,
  userId TEXT NOT NULL,
  errorMessage TEXT,
  createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
  updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (deployRequestId) REFERENCES deploy_requests(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS build_logs (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  buildTaskId TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (buildTaskId) REFERENCES build_tasks(id) ON DELETE CASCADE
);

-- Default users (passwords are SHA-256 hashed)
INSERT OR IGNORE INTO users (id, username, password, role, active) VALUES
  ('user-admin-001', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', 1),
  ('user-approver-001', 'approver', '5b8e5c5c1c6e0e9c4e3e5c8b8e5c5c1c6e0e9c4e3e5c8b8e5c5c1c6e0e9c4', 'approver', 1),
  ('user-submitter-001', 'submitter', '9f5c3c1c6e0e9c4e3e5c8b8e5c5c1c6e0e9c4e3e5c8b8e5c5c1c6e0e9c4e3', 'submitter', 1);

-- Default environments
INSERT OR IGNORE INTO environments (id, name, type, description, enabled, serverHost, deployPath) VALUES
  ('env-testing-001', 'Testing', 'testing', '测试环境', 1, 'test.example.com', '/var/www/test'),
  ('env-staging-001', 'Staging', 'staging', '预发布环境', 1, 'staging.example.com', '/var/www/staging'),
  ('env-production-001', 'Production', 'production', '生产环境', 0, 'prod.example.com', '/var/www/prod');
