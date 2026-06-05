const jwt = require('jsonwebtoken');
const { pool: db } = require('../config/database');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: '访问令牌已过期，请刷新', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ message: '无效的访问令牌' });
    }
    req.user = user;
    next();
  });
};

const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      const [rows] = await db.query(
        'SELECT r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
        [req.user.userId]
      );
      if (rows.length === 0 || !roles.includes(rows[0].role_name)) {
        return res.status(403).json({ message: '权限不足' });
      }
      req.user.roleName = rows[0].role_name;
      next();
    } catch (error) {
      const { formatError } = require('./security');
      res.status(500).json({ message: '检查权限时出错', error: formatError(error) });
    }
  };
};

module.exports = { authenticateToken, requireRole };
