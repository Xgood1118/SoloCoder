# 采购申请工作流引擎

基于 Go Gin + Vue3 + PostgreSQL 的采购申请审批工作流系统。

## 功能特性

- ✅ 采购申请提交与管理
- ✅ 多级审批流程
- ✅ 条件分流（金额、部门等条件）
- ✅ 会签模式（多人审批）
- ✅ 状态回退功能
- ✅ 超时自动通过
- ✅ 审批历史记录
- ✅ 流程配置管理

## 技术栈

### 后端
- Go 1.21+
- Gin Web 框架
- GORM ORM
- PostgreSQL 数据库
- JWT 认证
- Cron 定时任务

### 前端
- Vue 3
- Pinia 状态管理
- Vue Router
- Element Plus UI
- Axios HTTP 客户端

## 项目结构

```
.
├── backend/                    # 后端项目
│   ├── cmd/
│   │   └── main.go            # 程序入口
│   ├── internal/
│   │   ├── config/            # 配置
│   │   ├── handler/           # API 处理器
│   │   ├── middleware/        # 中间件
│   │   ├── model/             # 数据模型
│   │   ├── repository/        # 数据访问层
│   │   └── service/           # 业务逻辑层
│   ├── config/
│   │   └── config.yaml        # 配置文件
│   ├── migrations/            # 数据库迁移
│   ├── pkg/
│   │   └── logger/            # 日志
│   └── go.mod
├── frontend/                   # 前端项目
│   ├── src/
│   │   ├── views/             # 页面组件
│   │   ├── layout/            # 布局组件
│   │   ├── components/        # 公共组件
│   │   ├── api/               # API 接口
│   │   ├── router/            # 路由配置
│   │   ├── stores/            # 状态管理
│   │   └── utils/             # 工具函数
│   └── package.json
└── README.md
```

## 快速开始

### 环境要求

- Go 1.21+
- Node.js 18+
- PostgreSQL 12+

### 数据库准备

1. 创建 PostgreSQL 数据库：

```sql
CREATE DATABASE purchase_workflow;
```

2. 配置数据库连接：

编辑 `backend/config/config.yaml`：

```yaml
database:
  host: localhost
  port: 5432
  user: postgres
  password: your_password
  dbname: purchase_workflow
  sslmode: disable
  timezone: Asia/Shanghai
```

### 后端启动

```bash
cd backend
go mod download
go run cmd/main.go
```

后端服务将在 `http://localhost:8080` 启动。

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:3000` 启动。

## 默认账号

系统会自动初始化以下测试账号：

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | admin | 管理员 |
| employee1 | 123456 | employee | 普通员工（张三） |
| supervisor1 | 123456 | supervisor | 主管（王主管） |
| dept_manager | 123456 | dept_manager | 部门经理（李经理） |
| finance1 | 123456 | finance | 财务专员 |
| finance_manager | 123456 | finance_manager | 财务经理 |
| risk_manager | 123456 | risk_manager | 风控经理 |

## 工作流说明

### 默认流程

```
提交申请 → 初审 → [条件分流]
           ↓
    ┌──────┴──────┐
    ↓             ↓
金额<1000     金额>=1000
    ↓             ↓
财务审核     部门经理审批
    ↓             ↓
    └──────┬──────┘
           ↓
财务经理&风控经理会签
           ↓
        完成
```

### 核心功能说明

1. **条件分流**：初审通过后根据金额大小自动选择审批路径
2. **会签模式**：财务经理和风控经理需同时审批通过
3. **超时处理**：财务审核节点48小时未处理自动通过
4. **状态回退**：支持回退到之前的审批节点重新处理

## API 接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 申请接口
- `POST /api/applications` - 创建采购申请
- `GET /api/applications/my` - 获取我的申请列表
- `GET /api/applications/:id` - 获取申请详情
- `GET /api/applications/:id/history` - 获取审批历史
- `POST /api/applications/approve` - 审批操作
- `POST /api/applications/rollback` - 回退申请

### 任务接口
- `GET /api/tasks/my` - 获取我的待审批任务

### 流程管理接口
- `GET /api/workflows` - 获取流程列表
- `GET /api/workflows/:id` - 获取流程详情
- `POST /api/workflows` - 创建流程
- `PUT /api/workflows/:id` - 更新流程
- `DELETE /api/workflows/:id` - 删除流程

## 核心设计

### 状态机设计

每个申请单的状态流转通过事件驱动：
- `pending` - 审批中
- `completed` - 已完成
- `rejected` - 已驳回

### 节点类型

- `start` - 开始节点
- `approval` - 审批节点
- `end` - 结束节点

### 审批类型

- `single` - 单人审批
- `countersign` - 会签（多人审批）

### 超时策略

- `notify` - 仅发送提醒
- `auto_approve` - 超时自动通过

## License

MIT
