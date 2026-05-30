# 特性开关服务 (Feature Flag Service)

一个企业级的特性开关管理系统，支持动态控制功能发布、灰度放量、用户定向等功能。

## 功能特性

### 核心功能
- **动态开关控制**：无需发版即可动态开启/关闭功能
- **白名单机制**：支持按用户ID或用户标签配置白名单
- **百分比灰度**：基于用户ID哈希的一致性百分比放量
- **条件规则**：支持多维度条件组合（AND/OR逻辑）
- **灰度批次**：多批次灰度发布管理
- **定时开关**：秒级精度的定时开启/关闭功能

### 高级特性
- **变更通知**：支持SSE和长轮询两种推送方式
- **多级缓存**：支持按开关配置不同的缓存过期时间
- **审计日志**：完整的操作审计记录
- **健康检查**：内置健康检查端点
- **多环境隔离**：DEV/TEST/STAGING/PRODUCTION环境隔离
- **应用隔离**：不同应用间开关配置相互隔离

## 技术栈

- Java 17
- Spring Boot 3.2.x
- Spring Data JPA
- Caffeine 缓存
- H2 Database (开发环境)
- MySQL (生产环境)
- Lombok

## 快速开始

### 编译项目
```bash
mvn clean package
```

### 运行服务
```bash
java -jar target/feature-flag-service-1.0.0.jar
```

### 访问服务
- 服务地址: http://localhost:8080
- H2控制台: http://localhost:8080/h2-console
- 健康检查: http://localhost:8080/actuator/health

## API 文档

### 开关值查询

```bash
POST /api/feature-flags/evaluate
Content-Type: application/json

{
  "flagKey": "new_payment_channel",
  "application": "order-service",
  "environment": "PRODUCTION",
  "userContext": {
    "userId": "user123",
    "userTags": ["VIP", "NEW_USER"],
    "attributes": {
      "city": "Beijing",
      "level": 3,
      "clientVersion": "2.5.0"
    }
  },
  "defaultValue": false
}
```

响应:
```json
{
  "flagKey": "new_payment_channel",
  "enabled": true,
  "reason": "WHITELIST_MATCH",
  "matchedRule": null,
  "grayBatch": null,
  "timestamp": 1234567890
}
```

### 开关管理

创建开关:
```bash
POST /api/feature-flags
Content-Type: application/json
X-User-Id: admin

{
  "flagKey": "new_payment_channel",
  "flagName": "新支付渠道",
  "description": "灰度放量新支付渠道",
  "status": "ON",
  "application": "order-service",
  "environment": "PRODUCTION",
  "groupName": "payment",
  "defaultValue": false,
  "cacheExpireSeconds": 60,
  "priority": 0
}
```

切换开关状态:
```bash
POST /api/feature-flags/{id}/toggle?enabled=true
X-User-Id: admin
```

### 白名单管理

添加用户到白名单:
```bash
POST /api/feature-flags/{flagId}/whitelist/users?userId=user123&description=测试用户
X-User-Id: admin
```

批量添加用户:
```bash
POST /api/feature-flags/{flagId}/whitelist/users/batch
Content-Type: application/json
X-User-Id: admin

["user123", "user456", "user789"]
```

### 灰度批次管理

创建灰度批次:
```bash
POST /api/feature-flags/{flagId}/gray-batches
Content-Type: application/json
X-User-Id: admin

{
  "batchName": "第一批白名单",
  "batchCode": "gray_v1",
  "batchOrder": 1,
  "status": "ON",
  "description": "首批1000人灰度",
  "targetUserCount": 1000,
  "rule": {
    "ruleType": "PERCENTAGE",
    "percentage": 10,
    "enabled": true
  }
}
```

### 定时开关配置

配置定时开启:
```bash
POST /api/feature-flags/{flagId}/schedules
Content-Type: application/json
X-User-Id: admin

{
  "scheduleName": "双十一零点开启",
  "targetStatus": "ON",
  "effectiveTime": "2024-11-11T00:00:00",
  "enabled": true
}
```

### 变更订阅

SSE订阅:
```bash
GET /api/feature-flags/events/subscribe?application=order-service
```

长轮询:
```bash
GET /api/feature-flags/events/poll?application=order-service&since=2024-01-01T00:00:00
```

### 审计日志

查询开关变更历史:
```bash
GET /api/audit-logs/flag/{flagKey}
```

## 规则匹配优先级

1. **白名单匹配** (最高优先级)
   - 用户ID白名单
   - 用户标签白名单

2. **灰度批次匹配**
   - 按批次顺序依次匹配
   - 每个批次可独立配置规则

3. **规则匹配**
   - 按优先级排序执行
   - 支持百分比规则和条件规则
   - 支持AND/OR逻辑组合

4. **默认值** (最低优先级)
   - 开关配置的默认值
   - 请求传入的默认值

## 支持的条件操作符

| 操作符 | 说明 |
|--------|------|
| EQUALS | 等于 |
| NOT_EQUALS | 不等于 |
| GREATER_THAN | 大于 |
| LESS_THAN | 小于 |
| GREATER_THAN_OR_EQUALS | 大于等于 |
| LESS_THAN_OR_EQUALS | 小于等于 |
| CONTAINS | 包含 |
| NOT_CONTAINS | 不包含 |
| IN | 在列表中 |
| NOT_IN | 不在列表中 |
| REGEX | 正则匹配 |

## 配置说明

### 缓存配置
```yaml
featureflag:
  cache:
    default-expire-seconds: 300    # 默认缓存过期时间
    maximum-size: 10000             # 最大缓存条目数
```

### 长轮询配置
```yaml
featureflag:
  long-polling:
    timeout-seconds: 30             # 长轮询超时时间
```

### 定时任务配置
```yaml
featureflag:
  schedule:
    cron-enabled: true              # 启用定时任务
```

## 生产环境部署

### 数据库配置
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/featureflag
    username: your_username
    password: your_password
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate:
      ddl-auto: validate
```

### 高可用部署
- 多实例部署，无状态服务
- 使用负载均衡器分发请求
- 数据库主从复制

### 监控告警
- 监控开关开启率异常波动
- 监控服务响应时间
- 监控错误率指标

## 项目结构

```
src/main/java/com/featureflag/
├── FeatureFlagApplication.java    # 启动类
├── config/                         # 配置类
│   ├── CacheConfig.java
│   └── JacksonConfig.java
├── controller/                     # 控制器
│   ├── FeatureFlagController.java
│   ├── WhiteListController.java
│   ├── GrayBatchController.java
│   ├── ScheduleConfigController.java
│   └── AuditLogController.java
├── service/                        # 服务层
│   ├── FeatureFlagEvaluationService.java
│   ├── FeatureFlagManagementService.java
│   ├── WhiteListService.java
│   ├── GrayBatchService.java
│   ├── ScheduleConfigService.java
│   ├── AuditLogService.java
│   └── FlagChangeEventService.java
├── engine/                         # 规则引擎
│   ├── PercentageCalculator.java
│   ├── ConditionMatcher.java
│   └── RuleEvaluator.java
├── repository/                     # 数据访问层
│   ├── FeatureFlagRepository.java
│   ├── WhiteListRepository.java
│   ├── GrayBatchRepository.java
│   ├── ScheduleConfigRepository.java
│   ├── AuditLogRepository.java
│   └── FlagChangeEventRepository.java
├── entity/                         # 实体类
│   ├── FeatureFlag.java
│   ├── FeatureRule.java
│   ├── RuleCondition.java
│   ├── WhiteList.java
│   ├── GrayBatch.java
│   ├── ScheduleConfig.java
│   ├── AuditLog.java
│   └── FlagChangeEvent.java
├── dto/                            # 数据传输对象
│   ├── FeatureFlagDTO.java
│   ├── FlagEvaluationRequest.java
│   ├── FlagEvaluationResponse.java
│   └── UserContext.java
├── enums/                          # 枚举类
│   ├── FeatureFlagStatus.java
│   ├── RuleType.java
│   ├── ConditionOperator.java
│   ├── LogicOperator.java
│   └── Environment.java
├── cache/                          # 缓存管理
│   └── FlagCacheManager.java
├── scheduler/                      # 定时任务
│   └── ScheduleTaskExecutor.java
├── exception/                      # 异常处理
│   └── GlobalExceptionHandler.java
└── health/                         # 健康检查
    └── FeatureFlagHealthIndicator.java
```

## 许可证

MIT License
