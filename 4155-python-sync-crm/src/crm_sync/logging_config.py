import sys
from pathlib import Path

from loguru import logger

from crm_sync.config import get_settings


def setup_logging() -> None:
    settings = get_settings()

    logger.remove()

    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )

    logger.add(
        sys.stdout,
        format=log_format,
        level=settings.log.level,
        enqueue=True,
    )

    log_file_path = Path(settings.log.file_path)
    log_file_path.parent.mkdir(parents=True, exist_ok=True)

    logger.add(
        settings.log.file_path,
        format=log_format,
        level=settings.log.level,
        rotation=settings.log.rotation,
        retention=settings.log.retention,
        compression="zip",
        enqueue=True,
    )

    error_log_path = log_file_path.parent / "error.log"
    logger.add(
        error_log_path,
        format=log_format,
        level="ERROR",
        rotation=settings.log.rotation,
        retention=settings.log.retention,
        compression="zip",
        enqueue=True,
    )
