# 内部系统权限控制模块

基于 Node.js + Express + MySQL 的完整权限控制系统，实现了登录认证、双Token机制、菜单权限、数据权限以及完整的安全防护。

## 🚀 快速开始

### 1. 环境准备
- Node.js >= 14
- MySQL >= 5.7

### 2. 安装依赖
```bash
npm install
```

### 3. 配置数据库
修改 `.env` 文件中的数据库连接配置：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=auth_system
```

### 4. 初始化数据库
```bash
npm run init-db
```

### 5. 启动服务
```bash
npm start
```

### 6. 访问系统
打开浏览器访问: http://localhost:3000/login

### 7. 测试账号
| 账号 | 密码 | 角色 | 数据权限 |
|------|------|------|----------|
| admin | 123456 | 超级管理员 | 全部 |
| director | 123456 | 销售总监 | 全部 |
| manager1 | 123456 | 销售主管 | 团队 |
| sales1 | 123456 | 普通销售 | 个人 |
| sales2 | 123456 | 普通销售 | 个人 |

## 📁 项目结构

```
├── app.js                 # 主应用入口
├── config/
│   └── database.js        # 数据库连接配置
├── middleware/
│   ├── auth.js            # JWT认证中间件
│   └── security.js        # 安全中间件(XSS、密码验证、ID校验)
├── models/
│   ├── User.js            # 用户模型
│   ├── Role.js            # 角色模型
│   ├── Menu.js            # 菜单模型
│   ├── Token.js           # Token模型
│   └── Customer.js        # 客户模型(数据权限演示)
├── controllers/
│   ├── authController.js  # 认证控制器
│   ├── roleController.js  # 角色控制器
│   ├── menuController.js  # 菜单控制器
│   ├── userController.js  # 用户控制器
│   └── customerController.js # 客户控制器
├── routes/
│   ├── auth.js            # 认证路由
│   ├── roles.js           # 角色路由
│   ├── menus.js           # 菜单路由
│   ├── users.js           # 用户路由
│   └── customers.js       # 客户路由
├── views/                 # EJS模板页面
│   ├── login.ejs
│   ├── register.ejs
│   ├── dashboard.ejs
│   ├── customers.ejs
│   ├── users.ejs
│   ├── roles.ejs
│   └── menus.ejs
├── public/
│   ├── css/style.css
│   └── js/app.js
├── sql/
│   └── init.sql           # 数据库初始化脚本
├── test_security.js       # 安全特性测试脚本
└── .env                   # 环境变量配置
```

## 🔐 核心功能

### 1. 用户认证模块
- **三种登录方式**: 支持用户名、邮箱、手机号登录
- **密码强度校验**: 至少8位，必须包含字母和数字
- **双Token机制**:
  - Access Token: 有效期15分钟，用于接口认证
  - Refresh Token: 有效期7天，存储在数据库中，用于刷新
- **无感刷新**: Access Token过期后自动刷新，用户无感知
- **登出清理**: 登出时清除Refresh Token

### 2. 角色管理
- 支持自定义角色名称
- 三种数据权限范围: `all`(全部) / `team`(团队) / `self`(个人)
- 角色菜单权限分配

### 3. 菜单权限
- 菜单树形结构，支持多级菜单
- 根据用户角色动态渲染左侧菜单
- 无权限菜单不显示，API层也会拦截

### 4. 数据权限
- **行级权限控制**: 根据角色自动过滤数据
- **越权防护(IDOR)**: 单条数据查询时校验归属关系
  - `self`: 只能访问owner_id = 当前用户ID的数据
  - `team`: 只能访问team_id = 当前用户团队ID的数据
  - `all`: 可访问所有数据

## 🛡️ 安全特性

### 1. SQL注入防护
- 所有数据库查询使用参数化查询(Prepared Statement)
- 不直接拼接用户输入到SQL语句
- ID参数类型校验，防止字符串注入

### 2. XSS防护
- 后端入库前使用 `xss` 库转义所有用户输入
- 前端渲染时使用 `textContent` 或 `escapeHtml()` 二次转义
- Helmet中间件设置CSP安全头

### 3. 越权访问防护
- 每个数据操作前校验用户权限
- 查询单条数据时自动校验归属关系
- 统一的权限校验中间件

### 4. 其他安全措施
- Helmet 安全头防护
- CORS 跨域配置
- Cookie 设置 httpOnly、secure、sameSite 属性
- 密码使用 bcrypt 加密存储(salt=10)
- 定时清理过期Refresh Token

## 🔌 API 接口

### 认证接口
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/auth/register | 用户注册 | ❌ |
| POST | /api/auth/login | 用户登录 | ❌ |
| POST | /api/auth/refresh-token | 刷新Access Token | ❌ |
| POST | /api/auth/logout | 登出 | ❌ |
| GET | /api/auth/me | 获取当前用户信息 | ✅ |
| GET | /api/auth/menus | 获取当前用户菜单 | ✅ |

### 角色管理(需超级管理员)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/roles | 获取角色列表 |
| GET | /api/roles/:id | 获取角色详情 |
| POST | /api/roles | 创建角色 |
| PUT | /api/roles/:id | 更新角色 |
| DELETE | /api/roles/:id | 删除角色 |
| GET | /api/roles/:id/menus | 获取角色菜单 |
| POST | /api/roles/:id/menus | 分配角色菜单 |

### 菜单管理
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/menus | 获取菜单树 | ✅ |
| GET | /api/menus/flat | 获取扁平菜单列表 | ✅ |
| GET | /api/menus/:id | 获取菜单详情 | ✅ |
| POST | /api/menus | 创建菜单 | ✅(管理员) |
| PUT | /api/menus/:id | 更新菜单 | ✅(管理员) |
| DELETE | /api/menus/:id | 删除菜单 | ✅(管理员) |

### 用户管理(需超级管理员)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users | 获取用户列表 |
| GET | /api/users/:id | 获取用户详情 |
| POST | /api/users | 创建用户 |
| PUT | /api/users/:id | 更新用户 |
| DELETE | /api/users/:id | 删除用户 |

### 客户管理(数据权限演示)
| 方法 | 路径 | 说明 | 越权防护 |
|------|------|------|----------|
| GET | /api/customers | 获取客户列表 | ✅ 自动过滤 |
| GET | /api/customers/:id | 获取客户详情 | ✅ 校验归属 |
| POST | /api/customers | 创建客户 | - |
| PUT | /api/customers/:id | 更新客户 | ✅ 校验归属 |
| DELETE | /api/customers/:id | 删除客户 | ✅ 校验归属 |

## 🧪 安全测试

运行安全测试脚本验证所有安全特性：
```bash
node test_security.js
```

## 📝 测试场景

### 越权测试(IDOR)
1. 登录 `sales1` (ID=4, 只能看自己的客户)
2. 客户列表中能看到ID=1、2的客户(owner_id=4)
3. 在搜索框输入ID=3(属于sales2的客户)
4. 系统返回403: "无权访问该客户数据，可能存在越权访问行为已被拦截"

### XSS测试
1. 登录 `admin` 进入角色管理
2. 新增角色，名称输入: `测试<script>alert(1)</script>`
3. 保存后角色名称显示为转义后的文本，不会执行脚本

### 菜单权限测试
1. 登录 `sales1` 只能看到"工作台"和"客户管理"菜单
2. 登录 `admin` 可以看到所有菜单包括"系统管理"
3. 直接在浏览器访问 `/system/roles`，sales1会被重定向到登录页

### 数据权限测试
1. `sales1` (self): 只能看到2条客户数据(owner_id=4)
2. `manager1` (team): 能看到4条客户数据(team_id=1)
3. `director` (all): 能看到所有客户数据

## ⚙️ 配置说明

### 环境变量 (.env)
```env
PORT=3000                    # 服务端口
DB_HOST=localhost            # 数据库地址
DB_PORT=3306                 # 数据库端口
DB_USER=root                 # 数据库用户名
DB_PASSWORD=root             # 数据库密码
DB_NAME=auth_system          # 数据库名
JWT_ACCESS_SECRET=...        # Access Token 密钥
JWT_REFRESH_SECRET=...       # Refresh Token 密钥
JWT_ACCESS_EXPIRES_IN=15m    # Access Token 有效期
JWT_REFRESH_EXPIRES_IN=7d    # Refresh Token 有效期
NODE_ENV=development         # 运行环境
```

### Token有效期配置
- 开发环境可适当延长Access Token有效期方便测试
- 生产环境建议使用更短的有效期和更强的密钥

## 📄 License

ISC
