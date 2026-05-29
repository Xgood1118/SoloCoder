# Windows PowerShell 脚本 - 设置 Go 国内代理
# 右键使用 PowerShell 运行，或在终端中执行：.\setup-proxy.ps1

Write-Host "=== Go 国内代理配置 ===" -ForegroundColor Green

# 设置七牛云代理（国内稳定）
$env:GOPROXY = "https://goproxy.cn,direct"
$env:GOSUMDB = "off"
$env:GO111MODULE = "on"

# 永久设置（用户级别环境变量）
[Environment]::SetEnvironmentVariable("GOPROXY", "https://goproxy.cn,direct", "User")
[Environment]::SetEnvironmentVariable("GOSUMDB", "off", "User")
[Environment]::SetEnvironmentVariable("GO111MODULE", "on", "User")

Write-Host "已设置 GOPROXY = https://goproxy.cn,direct" -ForegroundColor Cyan
Write-Host "已设置 GOSUMDB = off" -ForegroundColor Cyan
Write-Host "已设置 GO111MODULE = on" -ForegroundColor Cyan
Write-Host ""
Write-Host "请重新打开终端使环境变量生效，然后执行：" -ForegroundColor Yellow
Write-Host "  go mod tidy" -ForegroundColor White
Write-Host "  go build -o mqtt-bridge.exe ." -ForegroundColor White
Write-Host ""

# 验证 Go 是否可用
$goVersion = go version 2>$null
if ($goVersion) {
    Write-Host "Go 版本: $goVersion" -ForegroundColor Green
} else {
    Write-Host "警告: 未检测到 Go 命令，请先安装 Go 1.21+" -ForegroundColor Red
}

Read-Host "按回车键退出"
