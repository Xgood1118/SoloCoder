# 在有网络的机器上执行此脚本生成 vendor 离线包
# 生成后将 vendor 目录或 mqtt-bridge-vendor.zip 复制到离线机器使用

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Vendor 离线包生成工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------- 1. 检测 Go ----------
Write-Host "[1/3] 检测 Go 环境..." -ForegroundColor Yellow
if (-not (Get-Command "go" -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 未检测到 Go!" -ForegroundColor Red
    Write-Host "请安装: https://golang.google.cn/dl/" -ForegroundColor Cyan
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# ---------- 2. 设置代理 ----------
Write-Host ""
Write-Host "[2/3] 配置代理 & 下载依赖..." -ForegroundColor Yellow

$env:GOPROXY = "https://goproxy.cn,direct"
$env:GOSUMDB = "off"

& go mod tidy
if ($LASTEXITCODE -ne 0) {
    Write-Host "go mod tidy 失败!" -ForegroundColor Red
    exit 1
}
Write-Host "  依赖下载完成" -ForegroundColor Green

# ---------- 3. 生成 vendor ----------
Write-Host ""
Write-Host "[3/3] 生成 vendor 目录..." -ForegroundColor Yellow

& go mod vendor
if ($LASTEXITCODE -ne 0) {
    Write-Host "go mod vendor 失败!" -ForegroundColor Red
    exit 1
}
Write-Host "  vendor 目录已生成" -ForegroundColor Green

# ---------- 打包 ----------
Write-Host ""
Write-Host "打包为 zip..." -ForegroundColor Yellow
if (Test-Path "mqtt-bridge-vendor.zip") {
    Remove-Item "mqtt-bridge-vendor.zip" -Force
}
Compress-Archive -Path vendor -DestinationPath "mqtt-bridge-vendor.zip" -Force

$zipSize = (Get-Item "mqtt-bridge-vendor.zip").Length / 1KB
Write-Host "  完成: mqtt-bridge-vendor.zip ($([math]::Round($zipSize, 1)) KB)" -ForegroundColor Green

# ---------- 测试编译 ----------
Write-Host ""
Write-Host "测试离线编译..." -ForegroundColor Yellow
& go build -mod=vendor -o mqtt-bridge-test.exe .
if ($LASTEXITCODE -eq 0) {
    Write-Host "  离线编译验证成功!" -ForegroundColor Green
    Remove-Item "mqtt-bridge-test.exe" -Force
} else {
    Write-Host "  警告: 编译测试失败" -ForegroundColor Yellow
}

# ---------- 完成 ----------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "将以下文件复制到离线机器:" -ForegroundColor White
Write-Host "  1. vendor 目录  或  mqtt-bridge-vendor.zip" -ForegroundColor Cyan
Write-Host "  2. 项目所有源码文件" -ForegroundColor Cyan
Write-Host ""
Write-Host "在离线机器编译:" -ForegroundColor White
Write-Host "  go build -mod=vendor -o mqtt-bridge.exe ." -ForegroundColor Cyan
Write-Host ""
