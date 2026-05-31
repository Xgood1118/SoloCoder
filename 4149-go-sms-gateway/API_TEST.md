# SMS Gateway API 测试文档

## 服务启动

```bash
go run cmd/main.go
```

服务默认启动在 `http://localhost:8080`

## API 接口列表

### 1. 同步发送短信

**POST** `/api/v1/sms/send`

请求体：
```json
{
  "phone": "13900000001",
  "template_id": "SMS_123456",
  "template_vars": {
    "code": "123456",
    "product": "测试产品"
  },
  "ext_code": "001",
  "port": "8080",
  "callback_url": "http://your-callback-url.com/callback",
  "channel_group": "default"
}
```

curl 测试：
```bash
curl -X POST http://localhost:8080/api/v1/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13900000001",
    "template_id": "SMS_123456",
    "template_vars": {
      "code": "123456"
    },
    "ext_code": "001"
  }'
```

### 2. 异步发送短信

**POST** `/api/v1/sms/send_async`

请求体与同步发送相同，立即返回 message_id，发送结果通过回调通知。

curl 测试：
```bash
curl -X POST http://localhost:8080/api/v1/sms/send_async \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13900000002",
    "template_id": "SMS_123456",
    "template_vars": {
      "code": "654321"
    },
    "callback_url": "http://localhost:8080/test/callback"
  }'
```

### 3. 批量发送短信

**POST** `/api/v1/sms/batch_send`

请求体：
```json
{
  "phones": ["13900000001", "13900000002", "13900000003"],
  "template_id": "SMS_123456",
  "template_vars": [
    {"code": "111111"},
    {"code": "222222"},
    {"code": "333333"}
  ],
  "ext_code": "001",
  "channel_group": "default"
}
```

curl 测试：
```bash
curl -X POST http://localhost:8080/api/v1/sms/batch_send \
  -H "Content-Type: application/json" \
  -d '{
    "phones": ["13900000001", "13900000002"],
    "template_id": "SMS_123456",
    "template_vars": [
      {"code": "111111"},
      {"code": "222222"}
    ]
  }'
```

### 4. 异步批量发送短信

**POST** `/api/v1/sms/batch_send_async`

请求体与批量发送相同。

curl 测试：
```bash
curl -X POST http://localhost:8080/api/v1/sms/batch_send_async \
  -H "Content-Type: application/json" \
  -d '{
    "phones": ["13900000001", "13900000002", "13900000003"],
    "template_id": "SMS_123456",
    "template_vars": [
      {"code": "111111"},
      {"code": "222222"},
      {"code": "333333"}
    ]
  }'
```

### 5. 通道状态回执回调

**POST** `/api/v1/callback/report?channel=aliyun`

请求体由运营商推送，示例：
```json
{
  "message_id": "test-message-id",
  "phone": "13900000001",
  "status": "delivered",
  "error_code": "0",
  "error_msg": "发送成功"
}
```

curl 测试：
```bash
curl -X POST "http://localhost:8080/api/v1/callback/report?channel=mock" \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": "test-msg-001",
    "phone": "13900000001",
    "status": "delivered",
    "error_code": "0",
    "error_msg": "发送成功"
  }'
```

### 6. 上行短信回调

**POST** `/api/v1/callback/mo?channel=aliyun`

请求体由运营商推送，示例：
```json
{
  "phone": "13900000001",
  "content": "T",
  "ext_code": "001"
}
```

curl 测试：
```bash
curl -X POST "http://localhost:8080/api/v1/callback/mo?channel=mock" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13900000001",
    "content": "TD",
    "ext_code": "001"
  }'
```

### 7. 获取通道列表

**GET** `/api/v1/channels`

curl 测试：
```bash
curl http://localhost:8080/api/v1/channels
```

响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "name": "aliyun",
      "type": "aliyun",
      "weight": 50,
      "group": "default",
      "enabled": true,
      "healthy": true,
      "total_requests": 100,
      "failed_requests": 5,
      "success_rate": 0.95
    }
  ]
}
```

### 8. 获取监控指标

**GET** `/api/v1/metrics`

curl 测试：
```bash
curl http://localhost:8080/api/v1/metrics
```

响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": {
      "success": 95,
      "failed": 5
    },
    "channels": {
      "aliyun": {
        "success": 50,
        "failed": 2,
        "avg_latency": 0.123,
        "healthy": true
      }
    },
    "queue_size": 0
  }
}
```

### 9. 健康检查

**GET** `/api/v1/health`

curl 测试：
```bash
curl http://localhost:8080/api/v1/health
```

响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok",
    "total_channels": 2,
    "healthy_channels": 2,
    "queue_size": 0,
    "timestamp": 1717209600
  }
}
```

## 统一响应格式

所有接口返回格式统一：
```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- `code`: 0表示成功，非0表示错误
- `message`: 错误信息
- `data`: 响应数据

## 测试场景

### 场景1：正常发送短信
```bash
curl -X POST http://localhost:8080/api/v1/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"13900000001","template_id":"SMS_123456","template_vars":{"code":"123456"}}'
```

### 场景2：测试无效手机号（Mock通道会失败）
```bash
curl -X POST http://localhost:8080/api/v1/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000000","template_id":"SMS_123456"}'
```

### 场景3：测试缺少必填参数
```bash
curl -X POST http://localhost:8080/api/v1/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"13900000001"}'
```

### 场景4：批量发送
```bash
curl -X POST http://localhost:8080/api/v1/sms/batch_send \
  -H "Content-Type: application/json" \
  -d '{"phones":["13900000001","13900000002"],"template_id":"SMS_123456","template_vars":[{"code":"111"},{"code":"222"}]}'
```
