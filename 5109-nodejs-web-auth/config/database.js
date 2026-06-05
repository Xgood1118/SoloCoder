const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'auth_system'
};

const TABLE_SQL = {
  roles: `CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    data_scope ENUM('all', 'team', 'self') NOT NULL DEFAULT 'self',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  users: `CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INT,
    team_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  menus: `CREATE TABLE IF NOT EXISTS menus (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parent_id INT DEFAULT 0,
    name VARCHAR(100) NOT NULL,
    path VARCHAR(255),
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  role_menus: `CREATE TABLE IF NOT EXISTS role_menus (
    role_id INT NOT NULL,
    menu_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, menu_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  refresh_tokens: `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  customers: `CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    company VARCHAR(255),
    owner_id INT NOT NULL,
    team_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
};

async function initializeDatabase() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password
    });

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[DB] Database '${DB_CONFIG.database}' ensured`);

    await conn.query(`USE \`${DB_CONFIG.database}\``);

    const tableOrder = ['roles', 'users', 'menus', 'role_menus', 'refresh_tokens', 'customers'];
    for (const tableName of tableOrder) {
      await conn.query(TABLE_SQL[tableName]);
    }
    console.log('[DB] All tables ensured');

    const [roleRows] = await conn.query('SELECT COUNT(*) as cnt FROM roles');
    if (roleRows[0].cnt === 0) {
      await conn.query(`INSERT INTO roles (name, description, data_scope) VALUES
        ('超级管理员', '系统最高权限', 'all'),
        ('销售总监', '查看所有销售数据', 'all'),
        ('销售主管', '查看团队销售数据', 'team'),
        ('普通销售', '查看自己的客户数据', 'self')`);
      console.log('[DB] Seed data: roles inserted');
    }

    const [menuRows] = await conn.query('SELECT COUNT(*) as cnt FROM menus');
    if (menuRows[0].cnt === 0) {
      await conn.query(`INSERT INTO menus (parent_id, name, path, icon, sort_order) VALUES
        (0, '工作台', '/dashboard', 'dashboard', 1),
        (0, '客户管理', '/customers', 'users', 2),
        (0, '系统管理', '/system', 'setting', 3),
        (3, '用户管理', '/system/users', 'user', 1),
        (3, '角色管理', '/system/roles', 'team', 2),
        (3, '菜单管理', '/system/menus', 'menu', 3)`);

      await conn.query(`INSERT INTO role_menus (role_id, menu_id) VALUES
        (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6),
        (2, 1), (2, 2),
        (3, 1), (3, 2),
        (4, 1), (4, 2)`);
      console.log('[DB] Seed data: menus & role_menus inserted');
    }

    const [userRows] = await conn.query('SELECT COUNT(*) as cnt FROM users');
    if (userRows[0].cnt === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPwd = await bcrypt.hash('123456', 10);
      await conn.query(`INSERT INTO users (username, email, phone, password, role_id, team_id) VALUES
        ('admin', 'admin@example.com', '13800000001', ?, 1, NULL),
        ('director', 'director@example.com', '13800000002', ?, 2, NULL),
        ('manager1', 'manager1@example.com', '13800000003', ?, 3, 1),
        ('sales1', 'sales1@example.com', '13800000004', ?, 4, 1),
        ('sales2', 'sales2@example.com', '13800000005', ?, 4, 1)`,
        [hashedPwd, hashedPwd, hashedPwd, hashedPwd, hashedPwd]);
      console.log('[DB] Seed data: users inserted (password: 123456)');

      await conn.query(`INSERT INTO customers (name, phone, email, company, owner_id, team_id) VALUES
        ('客户A', '13900000001', 'customerA@example.com', '科技公司A', 4, 1),
        ('客户B', '13900000002', 'customerB@example.com', '科技公司B', 4, 1),
        ('客户C', '13900000003', 'customerC@example.com', '科技公司C', 5, 1),
        ('客户D', '13900000004', 'customerD@example.com', '科技公司D', 5, 1)`);
      console.log('[DB] Seed data: customers inserted');
    }

    await conn.end();
    return true;
  } catch (err) {
    console.error('[DB] Initialization failed:', err.message || err.code || String(err));
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    return false;
  }
}

const pool = mysql.createPool({
  host: DB_CONFIG.host,
  port: DB_CONFIG.port,
  user: DB_CONFIG.user,
  password: DB_CONFIG.password,
  database: DB_CONFIG.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

pool.on('connection', (connection) => {
  console.log('[DB] New pool connection established');
});

pool.on('release', (connection) => {});

function testConnection() {
  return pool.getConnection()
    .then(conn => {
      console.log('[DB] Connection test: OK');
      conn.release();
      return true;
    })
    .catch(err => {
      console.error('[DB] Connection test failed:', err.message || err.code || String(err));
      return false;
    });
}

module.exports = { pool, initializeDatabase, testConnection };
