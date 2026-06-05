# Solid Go Monitor

一个基于 SolidJS + Go (Gin) 的现代化监控面板系统。

## 功能特性

### 后端 (Go + Gin)
- **三种探针类型**: HTTP 接口、TCP 端口、进程监控
- **调度器**: 每个探针独立 `time.Ticker`，支持动态启停
- **环形缓冲**: 固定长度 100 条结果，自动覆盖最老数据
- **统计计算**: P50/P95/P99 响应时间（排序法实现）
- **事件系统**: 状态变更事件，channel + worker 异步消费
- **告警管理**:
  - 连续失败 N 次触发告警
  - 自动恢复降级
  - Webhook 通知（重试 2 次）
  - 告警升级（30 分钟未确认自动升级）
  - 告警确认与静默
  - 批量操作
- **内存存储**: `sync.Map` 存储探针配置和状态
- **进程监控**: 使用 `gopsutil` 库

### 前端 (SolidJS)
- **细粒度更新**: SolidJS 信号机制，100+ 探针流畅渲染
- **总览仪表盘**: 分组展示，按状态着色，实时刷新
- **探针管理**:
  - 增删改查
  - 拖拽分组（HTML5 Drag & Drop）
  - 克隆探针
  - 批量导入 (JSON)
  - 立即测试
  - 按状态筛选
- **探针详情**:
  - 成功率统计
  - P50/P95/P99 响应时间
  - 历史趋势图（SVG 实现）
  - 时间范围切换 (1h/6h/24h/7d)
  - 导出 PNG
  - 最近 10 次失败记录
- **告警中心**:
  - 当前告警列表
  - 历史告警记录（含持续时长）
  - 批量确认 / 批量静默
  - 按时间/名称排序
  - 已升级、已确认、已静默状态标识
- **事件流**: 实时事件列表，支持确认

## 项目结构

```
5210-solid-go-monitor/
├── backend/                    # Go 后端
│   ├── cmd/
│   │   └── main.go            # 入口文件
│   ├── internal/
│   │   ├── api/handler.go     # API 处理器
│   │   ├── model/model.go     # 数据模型
│   │   ├── probe/             # 探针实现
│   │   │   ├── http.go
│   │   │   ├── tcp.go
│   │   │   └── process.go
│   │   ├── scheduler/         # 调度器
│   │   │   └── scheduler.go
│   │   └── store/             # 存储层
│   │       ├── store.go
│   │       └── ringbuffer.go
│   └── go.mod
└── frontend/                   # SolidJS 前端
    ├── src/
    │   ├── pages/              # 页面组件
    │   │   ├── Dashboard.tsx   # 总览
    │   │   ├── Probes.tsx      # 探针管理
    │   │   ├── ProbeDetail.tsx # 探针详情
    │   │   ├── Alerts.tsx      # 告警中心
    │   │   └── Events.tsx      # 事件流
    │   ├── components/         # 可复用组件
    │   │   └── GroupProbes.tsx # 分组探针 (lazy load)
    │   ├── api.ts              # API 封装
    │   ├── types.ts            # TypeScript 类型
    │   ├── styles.css          # 全局样式
    │   └── main.tsx            # 入口
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    └── package.json
```

## API 接口

### 探针管理
- `GET    /api/probes`          # 获取所有探针
- `POST   /api/probes`          # 创建探针
- `GET    /api/probes/:id`      # 获取单探针
- `PUT    /api/probes/:id`      # 更新探针
- `PATCH  /api/probes/:id`      # 部分更新
- `DELETE /api/probes/:id`      # 删除探针
- `POST   /api/probes/:id/clone` # 克隆探针
- `POST   /api/probes/:id/test`  # 立即测试
- `POST   /api/probes/import`    # 批量导入

### 结果与统计
- `GET /api/probes/:id/results?since=&until=&limit=` # 历史结果
- `GET /api/probes/:id/stats`    # 统计数据
- `GET /api/probes/:id/failures?limit=` # 最近失败

### 事件与告警
- `GET    /api/events`          # 事件列表
- `POST   /api/events/:id/ack`  # 确认事件
- `GET    /api/alerts`          # 当前告警
- `GET    /api/alerts/history`  # 告警历史
- `POST   /api/alerts/:id/ack`  # 确认告警
- `POST   /api/alerts/:id/silence` # 静默告警
- `POST   /api/alerts/batch/ack`   # 批量确认
- `POST   /api/alerts/batch/silence` # 批量静默

### 其他
- `GET /api/overview`           # 总览统计
- `GET /api/groups`             # 所有分组

## 快速开始

### 后端

```bash
cd backend
go mod tidy
go run cmd/main.go
```

服务启动在 `:8080`，默认包含 6 个示例探针。

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端启动在 `:3000`，已配置代理到后端 `:8080`。

## 技术说明

### 后端设计
- **并发安全**: 使用 `sync.Map` 和 `sync.RWMutex` 保证并发安全
- **无阻塞采集**: 事件通过 channel 异步消费，不阻塞采集循环
- **独立调度**: 每个探针有独立 ticker，可单独启停
- **Webhook 重试**: 失败时自动重试 2 次，指数退避

### 前端设计
- **细粒度响应式**: SolidJS createSignal 实现精确更新
- **懒加载**: 分组内容使用 `lazy` + `Suspense` 按需加载
- **无刷新切换**: 时间范围切换时图表即时更新
- **SVG 图表**: 轻量级 SVG 实现趋势图，导出 Canvas PNG
