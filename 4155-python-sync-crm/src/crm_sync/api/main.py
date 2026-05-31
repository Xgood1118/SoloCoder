from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from crm_sync.config import get_settings
from crm_sync.infrastructure import init_db
from .routers import sync, mappings, logs, health

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name} in {settings.app_env} mode")
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.warning(f"Database initialization warning: {e}")
    yield
    logger.info("Shutting down application")


app = FastAPI(
    title="CRM Sync Service API",
    description="CRM与营销平台数据同步服务",
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

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(mappings.router, prefix="/api/v1/mappings", tags=["mappings"])
app.include_router(logs.router, prefix="/api/v1/logs", tags=["logs"])


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "environment": settings.app_env,
    }
