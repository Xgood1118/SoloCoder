"""
FastAPI主应用
CRM同步服务管理后台接口
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from sync_crm.config import settings
from sync_crm.infrastructure.logging import get_logger
from sync_crm.infrastructure.database import init_database
from sync_crm.api.routes import sync, config, monitor, mapping

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info(f"启动CRM同步服务, 环境: {settings.app_env}, 版本: {settings.app_name}")
    try:
        init_database()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}", exc_info=True)
    yield
    logger.info("CRM同步服务关闭")


app = FastAPI(
    title="CRM同步服务 API",
    description="CRM系统与营销自动化平台数据同步服务管理接口",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理"""
    logger.error(f"请求异常: {request.method} {request.url}, 错误: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": type(exc).__name__,
            "message": str(exc),
            "path": str(request.url),
        },
    )


@app.get("/health", summary="健康检查")
async def health_check():
    """服务健康检查"""
    return {
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
        "version": "1.0.0",
    }


@app.get("/ready", summary="就绪检查")
async def ready_check():
    """服务就绪检查"""
    from sync_crm.infrastructure.database import engine
    from sync_crm.infrastructure.distributed_lock import get_redis_client

    db_ok = False
    redis_ok = False

    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        db_ok = True
    except Exception as e:
        logger.error(f"数据库连接检查失败: {e}")

    try:
        redis = get_redis_client()
        redis.ping()
        redis_ok = True
    except Exception as e:
        logger.error(f"Redis连接检查失败: {e}")

    is_ready = db_ok and redis_ok

    return {
        "status": "ready" if is_ready else "not_ready",
        "checks": {
            "database": "ok" if db_ok else "error",
            "redis": "ok" if redis_ok else "error",
        },
    }


app.include_router(sync.router, prefix="/api/v1/sync", tags=["同步管理"])
app.include_router(config.router, prefix="/api/v1/config", tags=["配置管理"])
app.include_router(monitor.router, prefix="/api/v1/monitor", tags=["监控统计"])
app.include_router(mapping.router, prefix="/api/v1/mapping", tags=["映射管理"])
