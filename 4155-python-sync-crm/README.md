# CRM同步服务

CRM与营销平台数据同步服务，实现准实时双向数据同步。

## 功能特性

- 🚀 **管道式架构**: Source -> Transformer -> Target -> Verifier
- 🔄 **双向同步**: CRM <-> 营销平台
- ⚡ **多种触发**: 定时调度、变更触发、手工触发
- 🛡️ **防循环同步**: sync_source标记机制
- 🔍 **数据一致性校验**: 自动校验两边数据一致性
- 📊 **详细日志**: 完整的同步日志和监控
- 🚨 **告警机制**: 延迟告警、失败告警、不一致告警

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy 2.0
- **任务队列**: Celery + Redis
- **任务调度**: Celery Beat
- **配置管理**: Pydantic Settings
- **日志**: Loguru
- **重试**: Tenacity

## 快速开始

### 环境要求

- Python 3.10+
- MySQL 8.0+
- Redis 7.0+

### 使用Docker启动

```bash
docker-compose up -d
```

访问: http://localhost:8000/docs

### 本地开发

1. 安装依赖

```bash
pip install -e .
```

2. 配置环境变量

```bash
cp .env.example .env
```

3. 启动服务

```bash
# 启动API服务
uvicorn crm_sync.api.main:app --reload

# 启动Celery Worker
celery -A crm_sync.tasks.celery_app worker --loglevel=info

# 启动定时任务
celery -A crm_sync.tasks.celery_app beat --loglevel=info
```

## 项目结构

```
src/crm_sync/
├── __init__.py
├── config/                 # 配置管理
│   ├── __init__.py
│   ├── settings.py         # 应用配置
│   └── field_mapping.py    # 字段映射配置
├── core/                   # 核心同步框架
│   ├── __init__.py
│   ├── pipeline.py         # 同步管道
│   ├── source.py           # 数据源接口
│   ├── transformer.py      # 数据转换
│   ├── target.py           # 目标系统接口
│   └── verifier.py         # 一致性校验
├── models/                 # 数据库模型
│   ├── __init__.py
│   ├── sync_mapping.py     # ID映射表
│   ├── sync_log.py         # 同步日志表
│   └── sync_task.py        # 同步任务表
├── infrastructure/         # 基础设施
│   ├── __init__.py
│   ├── database.py         # 数据库连接
│   └── redis_client.py     # Redis客户端
├── adapters/               # 系统适配器
│   ├── __init__.py
│   ├── base.py             # 基础API适配器
│   ├── crm_adapter.py      # CRM适配器
│   └── marketing_adapter.py # 营销平台适配器
├── services/               # 业务服务
│   ├── __init__.py
│   ├── base_sync.py        # 基础同步服务
│   ├── customer_sync.py    # 客户同步
│   ├── contact_sync.py     # 联系人同步
│   ├── lead_sync.py        # 线索同步
│   └── order_sync.py       # 订单同步
├── tasks/                  # 异步任务
│   ├── __init__.py
│   ├── celery_app.py       # Celery配置
│   └── sync_tasks.py       # 同步任务
├── monitoring/             # 监控告警
│   ├── __init__.py
│   ├── alert.py            # 告警服务
│   └── delay_monitor.py    # 延迟监控
└── api/                    # API接口
    ├── __init__.py
    ├── main.py             # FastAPI应用
    └── routers/            # 路由
```

## API接口

### 同步管理

- `POST /api/v1/sync/customer/full` - 触发客户全量同步
- `POST /api/v1/sync/contact/full` - 触发联系人全量同步
- `POST /api/v1/sync/lead/full` - 触发线索全量同步
- `POST /api/v1/sync/order/full` - 触发订单全量同步
- `POST /api/v1/sync/all/full` - 触发全量同步所有数据
- `GET /api/v1/sync/status` - 获取同步状态

### 字段映射

- `GET /api/v1/mappings/{entity_type}` - 获取ID映射
- `GET /api/v1/mappings/{entity_type}/config` - 获取字段映射配置
- `PUT /api/v1/mappings/{entity_type}/config` - 更新字段映射配置

### 日志查询

- `GET /api/v1/logs` - 查询同步日志
- `GET /api/v1/logs/{id}` - 获取单条日志详情
- `GET /api/v1/logs/summary/daily` - 获取每日汇总

### 健康检查

- `GET /api/v1/health` - 服务健康检查
- `GET /` - 服务信息

## 定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| sync_customer_incremental | 每5分钟 | 客户增量同步 |
| sync_contact_incremental | 每5分钟 | 联系人增量同步 |
| sync_lead_incremental | 每2分钟 | 线索增量同步 |
| sync_order_incremental | 每10分钟 | 订单增量同步 |
| check_data_consistency | 每天凌晨2点 | 数据一致性检查 |

## 配置说明

### 字段映射配置

字段映射配置文件位于 `config/field_mappings/{entity_type}.json`

示例：
```json
{
  "entity_type": "customer",
  "direction": "crm_to_marketing",
  "source_primary_key": "id",
  "target_primary_key": "uuid",
  "deduplication_fields": ["phone", "company_name"],
  "mappings": [
    {
      "source_field": "company_name",
      "target_field": "name",
      "direction": "crm_to_marketing",
      "required": true
    }
  ]
}
```

### 支持的数据转换

- `date_format` - 日期格式转换
- `phone_format` - 手机号格式转换
- `amount_scale` - 金额单位转换
- `enum_mapping` - 枚举值映射
- `default_value` - 默认值

## 数据库设计

### sync_mappings (ID映射表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| local_id | VARCHAR | 本地系统ID |
| remote_id | VARCHAR | 远程系统ID |
| entity_type | VARCHAR | 实体类型 |
| sync_version | INT | 版本号(乐观锁) |
| status | ENUM | 状态 |
| last_sync_time | DATETIME | 最后同步时间 |

### sync_logs (同步日志表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| task_id | VARCHAR | 任务ID |
| entity_type | VARCHAR | 实体类型 |
| operation_type | ENUM | 操作类型 |
| record_count | INT | 记录数 |
| success_count | INT | 成功数 |
| failed_count | INT | 失败数 |
| status | ENUM | 状态 |
| error_detail | TEXT | 错误详情 |

## 告警

支持以下告警渠道：
- 企业微信 Webhook
- 钉钉 Webhook

告警类型：
- 同步延迟告警（默认5分钟阈值）
- 同步失败告警
- 数据不一致告警

## License

MIT
