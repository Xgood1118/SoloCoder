const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const { initializeDatabase, testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const roleRoutes = require('./routes/roles');
const menuRoutes = require('./routes/menus');
const userRoutes = require('./routes/users');
const customerRoutes = require('./routes/customers');

const { authenticateToken } = require('./middleware/auth');
const Token = require('./models/Token');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "data:"]
    }
  }
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

setInterval(() => {
  Token.deleteExpiredTokens().catch(() => {});
}, 60 * 60 * 1000);

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/dashboard', authenticateToken, (req, res) => {
  res.render('dashboard');
});

app.get('/customers', authenticateToken, (req, res) => {
  res.render('customers');
});

app.get('/system/users', authenticateToken, (req, res) => {
  res.render('users');
});

app.get('/system/roles', authenticateToken, (req, res) => {
  res.render('roles');
});

app.get('/system/menus', authenticateToken, (req, res) => {
  res.render('menus');
});

app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);

app.use((err, req, res, next) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? (err.message || err.sqlMessage || String(err)) : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

const PORT = process.env.PORT || 8102;

async function startServer() {
  console.log('='.repeat(50));
  console.log('  内部运营系统 - 启动中...');
  console.log('='.repeat(50));

  console.log('[Startup] 正在初始化数据库...');
  const dbInitResult = await initializeDatabase();

  if (!dbInitResult) {
    console.error('[Startup] ⚠️  数据库初始化失败！请检查以下配置：');
    console.error('  - MySQL 服务是否已启动');
    console.error('  - .env 文件中的 DB_HOST, DB_PORT, DB_USER, DB_PASSWORD 是否正确');
    console.error('  - 数据库用户是否有 CREATE DATABASE 权限');
    console.error('');
    console.error('  继续启动服务器，但数据库相关功能将不可用...');
  } else {
    console.log('[Startup] ✅ 数据库初始化完成');
    const connOk = await testConnection();
    if (!connOk) {
      console.error('[Startup] ⚠️  数据库连接测试失败，请检查配置');
    }
  }

  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`  ✅ 服务器已启动: http://localhost:${PORT}`);
    console.log(`  📋 登录页面: http://localhost:${PORT}/login`);
    console.log(`  🔑 测试账号: admin / 123456`);
    console.log('='.repeat(50));
  });
}

startServer().catch(err => {
  console.error('[Startup] Fatal error:', err);
  process.exit(1);
});

module.exports = app;
