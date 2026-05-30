# MQ 消息模拟器 - 使用指南

## 项目简介

MQ 消息模拟器是一个功能强大的消息中间件测试工具，支持 RabbitMQ、Kafka 消息发送、消费、定时发送和流量回放等功能。

## 功能特性

### 核心功能
- ✅ 支持 RabbitMQ 和 Kafka 两种 MQ 类型
- ✅ 多种消息格式：JSON、XML、PlainText、Avro、Protobuf
- ✅ 消息模板管理（内置订单创建、用户登录、支付回调）
- ✅ 定时发送（指定时间、间隔、突发、预热）
- ✅ 流量录制与回放（倍速/慢速）
- ✅ 延迟消息支持
- ✅ 死信队列管理
- ✅ 消息过滤（内容、Header、Topic 通配符、JSONPath）
- ✅ 序列化处理（Avro/Protobuf Schema）

## 快速开始

### 1. 编译项目

```bash
# 使用 Maven 编译
mvn clean package -DskipTests

# 生成可执行 JAR
mvn clean package shade:shade -DskipTests
```

### 2. 查看帮助

```bash
java -jar mq-simulator.jar -h
```

### 3. 进入交互模式

```bash
java -jar mq-simulator.jar -i
```

## 使用示例

### 消息发送

```bash
# 发送简单 JSON 消息到 Kafka
java -jar mq-simulator.jar -t KAFKA --bootstrap-servers localhost:9092 \
  -o send --topic test.topic -m '{"id":1,"name":"test"}'

# 发送多条消息，间隔 500ms
java -jar mq-simulator.jar -t KAFKA -o send --topic test.topic \
  -c 10 --interval 500 -m '{"message":"Hello MQ"}'

# 使用模板发送消息
java -jar mq-simulator.jar -t KAFKA -o send --topic order.created \
  --template "订单创建"
```

### 消息消费

```bash
# 消费指定 Topic
java -jar mq-simulator.jar -t KAFKA -o consume --topic test.topic

# 使用通配符订阅多个 Topic
java -jar mq-simulator.jar -t KAFKA -o consume --topic "order.*"

# RabbitMQ 消费队列
java -jar mq-simulator.jar -t RABBITMQ -o consume --topic order_queue
```

### 消息过滤

```bash
# 配置内容过滤后消费
java -jar mq-simulator.jar -t KAFKA -o filter -m "success"
java -jar mq-simulator.jar -t KAFKA -o consume --topic order.*
```

### 定时发送

```bash
# 速率控制：每秒 100 条，持续 60 秒
java -jar mq-simulator.jar -t KAFKA -o schedule --topic test.topic \
  --rate 100 -m '{"type":"heartbeat"}'

# 间隔发送：每 1 秒 1 条，共 10 条
java -jar mq-simulator.jar -t KAFKA -o schedule --topic test.topic \
  -c 10 --interval 1000 -m '{"type":"interval"}'

# 突发发送：一次性发送 1000 条
java -jar mq-simulator.jar -t KAFKA -o schedule --topic test.topic \
  -c 1000 -m '{"type":"burst"}'
```

### 流量录制与回放

```bash
# 录制流量
java -jar mq-simulator.jar -t KAFKA -o record --topic order.created
# 输入 stop 停止录制

# 查看可用录制
java -jar mq-simulator.jar -t KAFKA -o replay

# 回放量倍速
java -jar mq-simulator.jar -t KAFKA -o replay --topic order.replay
```

### 延迟消息

```bash
# 使用延迟等级（1=1秒，2=5秒，3=10秒，4=30秒，5=1分钟...）
java -jar mq-simulator.jar -t KAFKA -o delay --topic test.topic \
  --delay-level 3 -m '{"type":"delayed"}'

# 自定义延迟毫秒
java -jar mq-simulator.jar -t KAFKA -o delay --topic test.topic \
  --delay-ms 15000 -m '{"type":"custom-delay"}'
```

### 模板管理

```bash
# 查看所有模板
java -jar mq-simulator.jar -o template

# 查看特定模板详情
java -jar mq-simulator.jar -o template --template "订单创建"

# 使用模板发送消息
java -jar mq-simulator.jar -o template --template "订单创建" --topic order.created
```

### 死信队列管理

```bash
# 查看 DLQ 状态
java -jar mq-simulator.jar -t KAFKA -o dlq
```

## 交互模式命令

进入交互模式后可用以下命令：

```
help              - 显示帮助信息
send [topic]      - 发送测试消息
consume [topic]   - 消费指定主题
templates         - 查看消息模板
config            - 查看当前配置
status            - 查看运行状态
quit/exit         - 退出程序
```

## 消息格式说明

### JSON 格式
```json
{
  "orderId": "ORD001",
  "userId": "U001",
  "amount": 99.99,
  "status": "SUCCESS"
}
```

### XML 格式
```xml
<order>
  <orderId>ORD001</orderId>
  <userId>U001</userId>
  <amount>99.99</amount>
  <status>SUCCESS</status>
</order>
```

### Avro 格式
需要先注册 Schema，然后使用 Schema 序列化消息。

## 模板占位符

模板支持以下占位符替换：

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `${orderId}` | 订单ID，自动生成UUID | `${orderId}` |
| `${userId}` | 用户ID，默认U001 | `${userId}` |
| `${timestamp}` | 当前时间戳 | `${timestamp}` |
| `${random}` | 随机数 | `${random}` |
| `${uuid}` | 生成UUID | `${uuid}` |
| `${date}` | 当前日期 | `${date}` |

支持默认值语法：`${variable|defaultValue}`

## 延迟等级说明

| 等级 | 延迟时间 |
|------|----------|
| 1 | 1 秒 |
| 2 | 5 秒 |
| 3 | 10 秒 |
| 4 | 30 秒 |
| 5 | 1 分钟 |
| 6 | 2 分钟 |
| 7 | 3 分钟 |
| 8 | 4 分钟 |
| 9 | 5 分钟 |
| 10 | 10 分钟 |
| 11 | 30 分钟 |
| 12 | 2 小时 |

## 配置说明

### Kafka 配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| bootstrap.servers | localhost:9092 | Kafka 服务器地址 |
| group.id | mq-simulator-group | 消费者组ID |
| auto.commit | true | 是否自动提交 |
| acks | all | 生产者确认模式 |
| retries | 3 | 重试次数 |

### RabbitMQ 配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| host | localhost | RabbitMQ 主机 |
| port | 5672 | RabbitMQ 端口 |
| username | guest | 用户名 |
| password | guest | 密码 |
| virtual.host | / | 虚拟主机 |

## 目录结构

```
mq-simulator/
├── src/main/java/com/mq/simulator/
│   ├── cli/              # 命令行交互
│   ├── config/           # 配置类
│   ├── consumer/         # 消息消费
│   ├── core/             # 核心枚举
│   ├── delay/            # 延迟消息
│   ├── dlq/              # 死信队列
│   ├── filter/           # 消息过滤
│   ├── gui/              # Swing GUI 界面
│   ├── http/             # Netty HTTP 接口
│   ├── model/            # 数据模型
│   ├── record/           # 流量录制回放
│   ├── scheduler/        # 定时调度
│   ├── schema/           # 序列化处理
│   ├── sender/           # 消息发送
│   └── template/         # 模板管理
├── src/main/resources/
│   ├── schemas/          # Avro/Protobuf Schema
│   ├── logback.xml       # 日志配置
│   ├── config-example.properties  # 配置示例
│   └── templates-example.json    # 模板示例
├── USAGE.md              # 使用文档
└── pom.xml               # Maven 配置
```

## 常见问题

### 1. 如何连接远程 MQ 服务器？

```bash
# Kafka
java -jar mq-simulator.jar -t KAFKA --bootstrap-servers kafka-host:9092 ...

# RabbitMQ
java -jar mq-simulator.jar -t RABBITMQ -H rabbitmq-host -p 5672 \
  -u admin -P password ...
```

### 2. 如何使用 Avro 序列化？

1. 准备 Avro Schema 文件（.avsc）
2. 放置到 schemas 目录或通过 API 注册
3. 指定消息格式为 AVRO 并指定 Schema 名称

### 3. 如何实现高并发压力测试？

使用 `--rate` 参数配合预热模式：

```bash
# 预热模式：从 10 逐步提升到 1000 条/秒，预热时间 60 秒
java -jar mq-simulator.jar -o schedule --topic stress.test \
  --rate 1000 -m '{"stress":true}'
```

## 许可证

本项目仅供测试和学习使用。
