# MQTT-Bridge 构建指南

## 问题说明
国内网络环境下，`go mod tidy` 可能无法访问 `proxy.golang.org` 下载依赖。

## 解决方案

### 方案一：设置国内代理（推荐）
运行 `setup-proxy.ps1` 脚本自动配置，或手动执行：

```powershell
# 临时设置（当前终端有效）
$env:GOPROXY = "https://goproxy.cn,direct"
$env:GOSUMDB = "off"

# 或者永久设置
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=off
```

然后执行：
```bash
go mod tidy
go build -o mqtt-bridge.exe .
```

### 方案二：使用可用的代理镜像
如果 goproxy.cn 也无法访问，可尝试：
- 阿里云：`https://mirrors.aliyun.com/goproxy/`
- 七牛云：`https://goproxy.cn`
- 中科大：`https://goproxy.ustc.edu.cn`

### 方案三：离线 vendor 模式
如果可以在有网络的机器上先下载依赖：

```bash
# 在有网络的机器上执行
go mod vendor

# 将 vendor 目录复制到目标机器，然后编译
go build -mod=vendor -o mqtt-bridge.exe .
```

## 项目依赖（共 3 个直接依赖）
1. `github.com/eclipse/paho.mqtt.golang` - MQTT 客户端（必需）
2. `github.com/jmespath/go-jmespath` - JMESPath 模板引擎（可选，可移除）
3. `gopkg.in/yaml.v3` - YAML 配置解析（已支持 JSON 格式作为替代）

## 最简依赖版本（可选）
如果只想用最少依赖编译，可以：
1. 使用 `config.json` 配置（无需 YAML）
2. 移除 JMESPath 功能（修改 converter.go）

## 运行
```bash
# 使用 JSON 配置（默认）
./mqtt-bridge.exe

# 使用 YAML 配置
./mqtt-bridge.exe -config config.yaml
```
