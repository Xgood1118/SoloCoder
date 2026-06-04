-- 创建角色表
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户角色关联表
CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE (user_id, role_id)
);

-- 插入默认角色
INSERT INTO roles (name, description) VALUES
('admin', '系统管理员，拥有所有权限'),
('user', '普通用户，基础访问权限'),
('guest', '访客用户，只读权限');

-- 为管理员用户分配管理员角色
INSERT INTO user_roles (user_id, role_id)
SELECT id, (SELECT id FROM roles WHERE name = 'admin')
FROM users WHERE username = 'admin';
