$ErrorActionPreference = "Stop"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  Image Management System - Start" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$projectRoot = $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"
$pythonExe = Join-Path $backendDir "venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Host "Python venv not found. Creating..." -ForegroundColor Yellow
    Set-Location $backendDir
    & python -m venv venv
    & .\venv\Scripts\pip.exe install -r requirements.txt
}

Write-Host "Starting backend server..." -ForegroundColor Yellow
Start-Process $pythonExe -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8119", "--reload" -WorkingDirectory $backendDir

Write-Host "Starting frontend dev server..." -ForegroundColor Yellow
Start-Process npm -ArgumentList "run", "dev" -WorkingDirectory $frontendDir

Write-Host ""
Write-Host "Backend:  http://localhost:8119" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "API Docs: http://localhost:8119/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit (servers will keep running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
