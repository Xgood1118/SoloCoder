-- 为用户表添加个人资料字段
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN avatar VARCHAR(255);
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN last_login_at DATETIME;
ALTER TABLE users ADD COLUMN login_count INT DEFAULT 0;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_last_login ON users(last_login_at);
