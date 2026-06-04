# 系统监控平台

一套完整的企业级系统监控工具，用于监控服务器运行状态和网络服务可用性，及时发现问题并告警。

## 功能特性

### 监控指标
- CPU使用率、CPU温度
- 内存占用率、内存使用量
- 磁盘空间使用率
- 网络流量（流入/流出）
- 进程数统计
- 系统负载、运行时间

### 灵活配置
- 采集间隔可配置（1秒 - 3600秒）
- 告警规则支持阈值配置（>、>=、<、<=）
- 支持持续时间检测和连续次数检测
- 监控模板功能，快速部署新主机

### 告警通知
- 邮件通知
- 钉钉机器人通知
- 短信通知（预留接口）
- 告警状态管理：触发中、已确认、已解决

### 安全特性
- Agent与Server之间TLS加密传输
- Agent端Server身份认证
- API密钥认证机制

### 可视化面板
- 自定义监控面板布局（拖拽）
- 多种图表类型（折线图、仪表盘）
- 自动刷新/手动刷新
- 历史数据查询与趋势图

## 项目结构

```
.
├── agent/              # 监控Agent
│   ├── agent.js        # Agent主程序
│   ├── config.json     # 配置文件
│   └── package.json
├── server/             # 监控Server
│   ├── app.js          # Server主程序
│   ├── config/         # 配置文件
│   ├── database/       # 数据库初始化
│   ├── middleware/     # 中间件
│   ├── models/         # 数据模型
│   ├── routes/         # API路由
│   ├── services/       # 业务服务
│   ├── scripts/        # 工具脚本
│   └── package.json
├── frontend/           # Web前端
│   ├── src/
│   │   ├── components/ # 组件
│   │   ├── pages/      # 页面
│   │   └── services/   # API服务
│   └── package.json
└── certs/              # TLS证书
```

## 快速开始

### 1. 安装依赖

```bash
# 安装Server依赖
cd server
npm install

# 安装Agent依赖
cd ../agent
npm install

# 安装Frontend依赖
cd ../frontend
npm install
```

### 2. 生成TLS证书

```bash
cd server
npm run init-certs
```

### 3. 启动Server

```bash
cd server
npm start
```
Server将在 `https://localhost:8443` 启动

### 4. 配置Agent

复制 `agent/config.example.json` 为 `agent/config.json`，并配置：
```json
{
  "serverUrl": "https://localhost:8443",
  "agentKey": "从主机管理页面获取的Agent Key",
  "interval": 60,
  "metrics": ["cpu", "memory", "disk", "network", "process"]
}
```

### 5. 启动Agent

```bash
cd agent
npm start
```

### 6. 启动前端

```bash
cd frontend
npm start
```
前端将在 `http://localhost:3000` 启动

## API 接口

### Agent接口
- `POST /agent/metrics` - 上报指标数据
- `GET /agent/config` - 获取Agent配置
- `POST /agent/heartbeat` - 心跳检测

### 管理API
- `GET /api/hosts` - 获取主机列表
- `POST /api/hosts` - 添加主机
- `DELETE /api/hosts/:id` - 删除主机
- `GET /api/metrics/:hostId` - 获取指标数据
- `GET /api/alerts` - 获取告警列表
- `POST /api/alerts/:id/acknowledge` - 确认告警
- `POST /api/alerts/:id/resolve` - 解决告警
- `GET /api/rules` - 获取告警规则
- `POST /api/rules` - 添加告警规则
- `GET /api/templates` - 获取监控模板
- `POST /api/templates/:id/apply/:hostId` - 应用模板
- `GET /api/dashboards` - 获取面板配置
- `POST /api/dashboards` - 保存面板配置

## 配置说明

### 告警规则配置示例

| 指标 | 阈值 | 操作符 | 持续时间 | 连续次数 | 说明 |
|------|------|--------|----------|----------|------|
| cpu_usage | 80 | > | 300秒 | 3次 | CPU超过80%持续5分钟或连续3次 |
| memory_usage | 90 | > | 180秒 | 3次 | 内存超过90%持续3分钟 |
| disk_usage | 85 | > | 600秒 | 3次 | 磁盘超过85%持续10分钟 |

### 监控模板

系统预置两个模板：
- Linux基础监控
- Windows基础监控

可通过API自定义模板。

## 开发说明

### 数据保留策略
- 指标数据：30天
- 告警记录：90天

### 安全建议
- 生产环境请使用正规CA签发的证书
- 修改默认的API密钥
- 配置防火墙限制Agent访问IP

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React + Ant Design + ECharts + react-grid-layout
- **Agent**: Node.js + systeminformation
- **通信**: HTTPS + WebSocket
