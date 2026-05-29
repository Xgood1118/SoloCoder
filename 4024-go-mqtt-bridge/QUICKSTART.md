# 快速开始指南

## 你有网络？直接一键构建

**右键运行 `build.ps1`** → 自动设置代理 → 自动下载依赖 → 自动编译

或在终端执行：
```powershell
.\build.ps1
```

---

## 你完全没网络？使用 vendor 离线包

### 步骤 1：在有网络的机器生成 vendor 包
```powershell
# 在有网络的 Windows 机器上执行
.\make-vendor.ps1
```
生成 `vendor/` 目录和 `mqtt-bridge-vendor.zip`

### 步骤 2：复制到离线机器并编译
```powershell
# 解压 vendor.zip（如有）
# Expand-Archive mqtt-bridge-vendor.zip -DestinationPath .

# 使用 vendor 模式编译
go build -mod=vendor -o mqtt-bridge.exe .
```

---

## 依赖下载失败？手动设置代理

```powershell
# 临时（当前终端）
$env:GOPROXY = "https://goproxy.cn,direct"
$env:GOSUMDB = "off"

# 永久
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=off

# 然后编译
go mod tidy
go build -o mqtt-bridge.exe .
```

---

## 可用的国内 Go 代理

| 服务商 | 地址 |
|--------|------|
| 七牛云 | https://goproxy.cn |
| 阿里云 | https://mirrors.aliyun.com/goproxy/ |
| 中科大 | https://goproxy.ustc.edu.cn |

---

## 运行

```powershell
# 使用默认配置 (config.json)
.\mqtt-bridge.exe

# 指定配置文件
.\mqtt-bridge.exe -config config.yaml
```

---

## 验证

发送一条测试 MQTT 消息，观察日志输出：
```
[bridge] delivered topic=sensors/temp
```

---

## 项目文件说明

| 文件 | 说明 |
|------|------|
| `main.go` | 程序入口 |
| `config/config.go` | 配置管理（支持 JSON/YAML） |
| `mqttclient/client.go` | MQTT 订阅客户端 |
| `converter/converter.go` | JMESPath 消息转换 |
| `webhook/webhook.go` | HTTP 发送 + 指数退避重试 |
| `deduplicator/deduplicator.go` | 5 秒窗口消息去重 |
| `config.json` / `config.yaml` | 配置示例 |
| `build.ps1` | 一键构建脚本 |
| `make-vendor.ps1` | 生成离线 vendor 包 |
| `setup-proxy.ps1` | 仅设置 Go 代理 |
