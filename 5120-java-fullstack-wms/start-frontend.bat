@echo off
echo ========================================
echo 仓库管理系统 - 前端启动脚本
echo ========================================
echo.
echo 正在启动前端开发服务器...
echo 前端地址: http://localhost:5120
echo 后端代理: http://localhost:8080
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

cd /d "%~dp0frontend"

npm run dev

pause
