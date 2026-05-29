# Vendor 离线包获取指南

## 问题
如果你的机器完全无法访问外网，`go mod tidy` 无法下载依赖，可以使用以下方案。

## 方案一：在有网络的机器上生成 vendor 包

### 步骤
1. 在有网络的 Windows/macOS/Linux 机器上安装 Go 1.21+
2. 下载本项目源码
3. 执行以下命令生成 vendor 目录：

```bash
# 设置国内代理
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=off

# 下载依赖并生成 vendor 目录
go mod tidy
go mod vendor

# 打包 vendor 目录
# Windows:
tar -czf mqtt-bridge-vendor.tar.gz vendor/
# 或使用 PowerShell:
Compress-Archive -Path vendor -DestinationPath mqtt-bridge-vendor.zip
```

4. 将 `mqtt-bridge-vendor.zip` 复制到离线机器，解压到项目根目录
5. 使用 vendor 模式编译：
```bash
go build -mod=vendor -o mqtt-bridge.exe .
```

## 方案二：使用一键脚本（有网络机器）

将以下脚本保存为 `make-vendor.ps1`，在有网络的机器上运行：

```powershell
$ErrorActionPreference = "Stop"

# 检测 Go
if (-not (Get-Command "go" -ErrorAction SilentlyContinue)) {
    Write-Host "请先安装 Go: https://golang.google.cn/dl/"
    exit 1
}

# 设置代理
$env:GOPROXY = "https://goproxy.cn,direct"
$env:GOSUMDB = "off"

# 创建临时目录
$tmpDir = Join-Path $env:TEMP "mqtt-bridge-build"
Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tmpDir | Out-Null

# 复制源码
Copy-Item -Path .\*.go -Destination $tmpDir
Copy-Item -Path .\go.mod -Destination $tmpDir
Copy-Item -Path .\go.sum -Destination $tmpDir
Copy-Item -Recurse -Path .\config, .\converter, .\deduplicator, .\mqttclient, .\webhook -Destination $tmpDir

# 生成 vendor
Push-Location $tmpDir
& go mod tidy
& go mod vendor
Pop-Location

# 复制 vendor 到当前目录
Copy-Item -Recurse -Path (Join-Path $tmpDir vendor) -Destination . -Force

# 打包
Compress-Archive -Path vendor -DestinationPath "mqtt-bridge-vendor.zip" -Force

Write-Host "完成! vendor 目录已生成并打包为 mqtt-bridge-vendor.zip"
Write-Host "大小: $((Get-Item mqtt-bridge-vendor.zip).Length / 1KB) KB"
```

## 方案三：直接下载预编译的二进制文件

如果你不需要修改源码，可以直接下载预编译版本：

### Windows x64 预编译包下载地址
- GitHub Actions 构建（如有）: 请查看项目 Releases 页面
- 或自行在有网络的机器编译后复制：`go build -o mqtt-bridge.exe .`

## vendor 目录结构说明

```
vendor/
├── github.com/
│   ├── eclipse/
│   │   └── paho.mqtt.golang/     # MQTT 客户端 (~500KB)
│   ├── gorilla/
│   │   └── websocket/            # WebSocket 支持 (~200KB)
│   └── jmespath/
│       └── go-jmespath/          # JMESPath 查询引擎 (~150KB)
└── gopkg.in/
    └── yaml.v3/                   # YAML 解析 (~100KB)
```

总大小约 1MB，压缩后约 300KB。

## 验证 vendor 是否正确

生成 vendor 后，执行以下命令验证：

```bash
# 不联网编译测试
go build -mod=vendor -o test.exe .
if ($LASTEXITCODE -eq 0) {
    Write-Host "vendor 验证成功!"
    Remove-Item test.exe
}
```

## 常见问题

**Q: vendor 目录很大?**
A: 完整 vendor 目录约 1MB，属于正常范围。可以通过 `go mod vendor -v` 查看包含的包。

**Q: 可以只包含必需的包吗?**
A: `go mod vendor` 已经自动只包含代码实际引用的包，无需手动精简。

**Q: 编译提示 "go: no modules to vendor"?**
A: 请确保在项目根目录执行，且 go.mod 文件存在。
