"""
CRM同步服务主入口
"""
import os
import sys
import click
import uvicorn

from sync_crm.config import settings
from sync_crm.infrastructure.logging import setup_logging
from sync_crm.infrastructure.database import init_database, engine

logger = setup_logging()


@click.group()
def cli():
    """CRM同步服务命令行工具"""
    pass


@cli.command()
@click.option("--host", default="0.0.0.0", help="监听地址")
@click.option("--port", default=8000, type=int, help="监听端口")
@click.option("--reload", is_flag=True, help="开发模式自动重载")
def run_api(host: str, port: int, reload: bool):
    """启动FastAPI服务"""
    logger.info(f"启动CRM同步API服务: {host}:{port}")
    uvicorn.run(
        "sync_crm.api.app:app",
        host=host,
        port=port,
        reload=reload,
        log_level=settings.log_level.lower(),
    )


@cli.command()
@click.option("--queue", default="default", help="Celery队列名称")
@click.option("--concurrency", default=4, type=int, help="并发数")
def run_worker(queue: str, concurrency: int):
    """启动Celery Worker"""
    from sync_crm.tasks.celery_app import app as celery_app

    logger.info(f"启动Celery Worker, 队列: {queue}, 并发: {concurrency}")
    worker = celery_app.Worker(
        queues=[queue],
        concurrency=concurrency,
        loglevel=settings.log_level.lower(),
    )
    worker.start()


@cli.command()
def run_beat():
    """启动Celery Beat定时任务调度器"""
    from sync_crm.tasks.celery_app import app as celery_app

    logger.info("启动Celery Beat定时任务调度器")
    beat = celery_app.Beat(
        loglevel=settings.log_level.lower(),
    )
    beat.start()


@cli.command()
def init_db():
    """初始化数据库表结构"""
    logger.info("开始初始化数据库...")
    try:
        init_database()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}", exc_info=True)
        sys.exit(1)


@cli.command()
def version():
    """显示版本信息"""
    from sync_crm import __version__

    click.echo(f"CRM同步服务 v{__version__}")


if __name__ == "__main__":
    cli()
