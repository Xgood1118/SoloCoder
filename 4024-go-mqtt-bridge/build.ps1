# MQTT-Bridge 一键构建脚本
# 右键 -> 使用 PowerShell 运行

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MQTT-Bridge 一键构建工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Find-GoExe {
    $goExe = Get-Command "go" -ErrorAction SilentlyContinue
    if ($goExe) { return $goExe.Source }

    $searchPaths = @(
        "C:\Program Files\Go\bin\go.exe",
        "C:\Program Files (x86)\Go\bin\go.exe",
        "$env:LOCALAPPDATA\Go\bin\go.exe",
        "$env:USERPROFILE\go\bin\go.exe",
        "$env:USERPROFILE\sdk\go1.21\bin\go.exe",
        "$env:USERPROFILE\sdk\go1.22\bin\go.exe",
        "$env:USERPROFILE\sdk\go1.23\bin\go.exe",
        "$env:USERPROFILE\sdk\go1.24\bin\go.exe",
        "$env:USERPROFILE\sdk\go1.25\bin\go.exe"
    )

    foreach ($path in $searchPaths) {
        if (Test-Path $path) { return $path }
    }

    $toolchainGo = Get-ChildItem -Path "$env:USERPROFILE\go\pkg\mod\golang.org" -Filter "go.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($toolchainGo) { return $toolchainGo.FullName }

    return $null
}

# ---------- 1. 检测 Go 环境 ----------
Write-Host "[1/5] 检测 Go 环境..." -ForegroundColor Yellow

$goExePath = Find-GoExe
if (-not $goExePath) {
    Write-Host ""
    Write-Host "错误: 未检测到 Go 编译器!" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先安装 Go 1.21 或更高版本:" -ForegroundColor White
    Write-Host "  国内镜像: https://golang.google.cn/dl/" -ForegroundColor Cyan
    Write-Host "  官方地址: https://go.dev/dl/" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}

$goVersion = & $goExePath version
Write-Host "  检测到: $goVersion" -ForegroundColor Green
Write-Host "  路径: $goExePath" -ForegroundColor Gray

# ---------- 2. 设置国内代理 ----------
Write-Host ""
Write-Host "[2/5] 配置国内 Go 代理..." -ForegroundColor Yellow

$env:GOPROXY = "https://goproxy.cn,direct"
$env:GOSUMDB = "off"
$env:GO111MODULE = "on"

try {
    & $goExePath env -w GOPROXY=https://goproxy.cn,direct
    & $goExePath env -w GOSUMDB=off
    Write-Host "  全局代理已设置: GOPROXY=https://goproxy.cn,direct" -ForegroundColor Green
} catch {
    Write-Host "  临时代理已设置 (当前会话有效)" -ForegroundColor Yellow
}

# ---------- 3. 下载依赖 ----------
Write-Host ""
Write-Host "[3/5] 下载依赖 (go mod tidy)..." -ForegroundColor Yellow

$tidyOutput = & $goExePath mod tidy 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "警告: go mod tidy 失败，尝试使用 vendor 模式..." -ForegroundColor Yellow

    if (Test-Path "vendor") {
        Write-Host "  检测到 vendor 目录，将使用 -mod=vendor 编译" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "错误: 无法下载依赖，且未找到 vendor 目录!" -ForegroundColor Red
        Write-Host ""
        Write-Host "解决方案:" -ForegroundColor White
        Write-Host "  1. 检查网络连接" -ForegroundColor Cyan
        Write-Host "  2. 尝试其他代理: https://mirrors.aliyun.com/goproxy/" -ForegroundColor Cyan
        Write-Host "  3. 或下载预编译的 vendor 包: 参见 VENDOR_DOWNLOAD.md" -ForegroundColor Cyan
        Write-Host ""
        Read-Host "按回车键退出"
        exit 1
    }
} else {
    Write-Host "  依赖下载完成" -ForegroundColor Green
}

# ---------- 4. 编译 ----------
Write-Host ""
Write-Host "[4/5] 编译项目..." -ForegroundColor Yellow

$buildArgs = @("build", "-o", "mqtt-bridge.exe")
if (Test-Path "vendor") {
    $buildArgs += "-mod=vendor"
}
$buildArgs += "."

$buildOutput = & $goExePath $buildArgs 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "错误: 编译失败!" -ForegroundColor Red
    Write-Host $buildOutput -ForegroundColor Red
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}

$exeSize = (Get-Item "mqtt-bridge.exe").Length / 1MB
Write-Host "  编译成功: mqtt-bridge.exe ($([math]::Round($exeSize, 1)) MB)" -ForegroundColor Green

# ---------- 5. 验证配置 ----------
Write-Host ""
Write-Host "[5/5] 验证配置文件..." -ForegroundColor Yellow

$configFile = "config.json"
if (-not (Test-Path $configFile)) {
    Write-Host "  警告: 未找到 config.json，请根据 config.yaml 示例创建" -ForegroundColor Yellow
} else {
    Write-Host "  配置文件已就绪: $configFile" -ForegroundColor Green
}

# ---------- 完成 ----------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  构建完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "运行方式:" -ForegroundColor White
Write-Host "  .\mqtt-bridge.exe" -ForegroundColor Cyan
Write-Host "  .\mqtt-bridge.exe -config config.json" -ForegroundColor Cyan
Write-Host ""
Write-Host "当前目录文件:" -ForegroundColor White
Get-ChildItem "mqtt-bridge.exe", "go.mod", "go.sum", "config.*" -ErrorAction SilentlyContinue | Format-Table Name, Length -AutoSize
Write-Host ""

Read-Host "按回车键退出"
