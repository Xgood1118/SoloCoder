@echo off
echo ========================================
echo CRM Sync Service - 启动脚本 (Windows)
echo ========================================

if not exist .env (
    echo [INFO] 复制环境变量配置文件...
    copy .env.example .env
)

echo [INFO] 安装依赖...
pip install -e .

echo.
echo [INFO] 初始化数据库...
set PYTHONPATH=%CD%\src
python scripts\init_db.py

echo.
echo ========================================
echo 启动方式选择:
echo   1. 启动 API 服务
echo   2. 启动 Celery Worker
echo   3. 启动 Celery Beat (定时任务)
echo   4. 全部启动 (需要3个终端)
echo   5. 退出
echo ========================================
set /p choice="请输入选项 (1-5): "

if "%choice%"=="1" (
    echo [INFO] 启动 API 服务...
    uvicorn crm_sync.api.main:app --reload --host 0.0.0.0 --port 8000
) else if "%choice%"=="2" (
    echo [INFO] 启动 Celery Worker...
    celery -A crm_sync.tasks.celery_app worker --loglevel=info --pool=solo
) else if "%choice%"=="3" (
    echo [INFO] 启动 Celery Beat...
    celery -A crm_sync.tasks.celery_app beat --loglevel=info
) else if "%choice%"=="4" (
    echo [INFO] 请分别在3个终端中运行以下命令:
    echo   终端1: uvicorn crm_sync.api.main:app --reload
    echo   终端2: celery -A crm_sync.tasks.celery_app worker --loglevel=info --pool=solo
    echo   终端3: celery -A crm_sync.tasks.celery_app beat --loglevel=info
) else (
    echo 退出
)
