"""
日志配置模块
支持结构化JSON日志和文本日志，自动关联trace_id
"""
import sys
import logging
from typing import Optional
from functools import lru_cache

from loguru import logger
import structlog

from sync_crm.config import settings


def _configure_loguru(log_level: str, log_format: str, enable_console: bool,
                      file_path: Optional[str] = None, rotation: str = "1 day",
                      retention: str = "30 days") -> None:
    """配置Loguru日志"""
    logger.remove()

    if enable_console:
        if log_format == "json":
            logger.add(
                sys.stdout,
                level=log_level,
                serialize=True,
                enqueue=True,
            )
        else:
            logger.add(
                sys.stdout,
                level=log_level,
                format=(
                    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
                    "<level>{level: <8}</level> | "
                    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                    "<level>{message}</level>"
                ),
                enqueue=True,
            )

    if file_path:
        if log_format == "json":
            logger.add(
                file_path,
                level=log_level,
                serialize=True,
                rotation=rotation,
                retention=retention,
                enqueue=True,
            )
        else:
            logger.add(
                file_path,
                level=log_level,
                format=(
                    "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | "
                    "{name}:{function}:{line} | {message}"
                ),
                rotation=rotation,
                retention=retention,
                enqueue=True,
            )


def _configure_structlog(log_level: str, log_format: str) -> None:
    """配置Structlog"""
    level = getattr(logging, log_level)

    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.format_exc_info,
    ]

    if log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )


@lru_cache()
def setup_logging() -> logging.Logger:
    """
    初始化日志配置

    Returns:
        配置好的logger实例
    """
    log_level = settings.log.log_level
    log_format = settings.log.format
    enable_console = settings.log.enable_console
    file_path = settings.log.file_path
    rotation = settings.log.rotation
    retention = settings.log.retention

    _configure_loguru(log_level, log_format, enable_console, file_path, rotation, retention)
    _configure_structlog(log_level, log_format)

    return get_logger()


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    获取logger实例

    Args:
        name: logger名称，不传则返回root logger

    Returns:
        logger实例
    """
    if name:
        return structlog.get_logger(name)
    return structlog.get_logger()
