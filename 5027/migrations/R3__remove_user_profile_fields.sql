-- 回滚 V3: 移除用户表新增的个人资料字段
DROP INDEX IF EXISTS idx_last_login;
ALTER TABLE users DROP COLUMN login_count;
ALTER TABLE users DROP COLUMN last_login_at;
ALTER TABLE users DROP COLUMN bio;
ALTER TABLE users DROP COLUMN avatar;
ALTER TABLE users DROP COLUMN phone;
