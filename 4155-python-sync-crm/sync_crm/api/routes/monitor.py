"""
监控统计接口
提供同步统计、延迟监控、一致性检查等功能
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from sync_crm.infrastructure.database import get_db
from sync_crm.infrastructure.logging import get_logger
from sync_crm.infrastructure.alerting import AlertLevel
from sync_crm.tasks.monitor_tasks import (
    get_sync_statistics,
    get_mapping_statistics,
    check_sync_delay,
    check_data_consistency,
    clean_old_logs,
    send_daily_report,
)
from sync_crm.tasks.celery_app import ping, health_check

router = APIRouter()
logger = get_logger(__name__)


@router.get("/statistics", summary="获取同步统计数据")
async def get_statistics(
    days: int = Query(7, ge=1, le=90, description="统计天数"),
    async_mode: bool = Query(False, description="是否异步执行"),
):
    """
    获取同步任务统计数据
    """
    try:
        if async_mode:
            result = get_sync_statistics.delay(days=days)
            return {
                "task_id": result.id,
                "status": "queued",
                "message": "统计任务已提交到后台执行",
            }
        else:
            result = get_sync_statistics.delay(days=days).get(timeout=60)
            return result
    except Exception as e:
        logger.error(f"获取同步统计失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/mapping-statistics", summary="获取映射表统计数据")
async def get_mapping_stats(
    async_mode: bool = Query(False, description="是否异步执行"),
):
    """
    获取映射表统计数据
    """
    try:
        if async_mode:
            result = get_mapping_statistics.delay()
            return {
                "task_id": result.id,
                "status": "queued",
                "message": "统计任务已提交到后台执行",
            }
        else:
            result = get_mapping_statistics.delay().get(timeout=30)
            return result
    except Exception as e:
        logger.error(f"获取映射统计失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/delay-check", summary="检查同步延迟")
async def check_delay(async_mode: bool = Query(False, description="是否异步执行")):
    """
    立即执行一次同步延迟检查
    """
    try:
        if async_mode:
            result = check_sync_delay.delay()
            return {
                "task_id": result.id,
                "status": "queued",
                "message": "延迟检查任务已提交到后台执行",
            }
        else:
            result = check_sync_delay.delay().get(timeout=60)
            return result
    except Exception as e:
        logger.error(f"检查同步延迟失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/consistency-check", summary="执行数据一致性检查")
async def run_consistency_check(async_mode: bool = Query(True, description="是否异步执行")):
    """
    执行全量数据一致性检查
    """
    try:
        if async_mode:
            result = check_data_consistency.delay()
            return {
                "task_id": result.id,
                "status": "queued",
                "message": "一致性检查任务已提交到后台执行，该任务可能需要较长时间",
            }
        else:
            result = check_data_consistency.delay().get(timeout=3600)
            return result
    except Exception as e:
        logger.error(f"执行一致性检查失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/clean-logs", summary="清理旧日志")
async def clean_logs(
    keep_days: int = Query(30, ge=1, le=365, description="保留天数"),
    async_mode: bool = Query(False, description="是否异步执行"),
):
    """
    清理指定天数之前的同步日志
    """
    try:
        if async_mode:
            result = clean_old_logs.delay(keep_days=keep_days)
            return {
                "task_id": result.id,
                "status": "queued",
                "message": "日志清理任务已提交到后台执行",
            }
        else:
            result = clean_old_logs.delay(keep_days=keep_days).get(timeout=300)
            return result
    except Exception as e:
        logger.error(f"清理旧日志失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/send-report", summary="发送每日报告")
async def send_report(async_mode: bool = Query(False, description="是否异步执行")):
    """
    立即发送一次每日同步报告
    """
    try:
        if async_mode:
            result = send_daily_report.delay()
            return {
                "task_id": result.id,
                "status": "queued",
                "message": "报告发送任务已提交到后台执行",
            }
        else:
            result = send_daily_report.delay().get(timeout=120)
            return result
    except Exception as e:
        logger.error(f"发送每日报告失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/health/celery", summary="Celery健康检查")
async def celery_health_check(async_mode: bool = Query(False, description="是否异步执行")):
    """
    检查Celery worker是否正常运行
    """
    try:
        if async_mode:
            result = ping.delay()
            return {
                "task_id": result.id,
                "status": "queued",
            }
        else:
            result = ping.delay().get(timeout=10)
            return result
    except Exception as e:
        logger.error(f"Celery健康检查失败: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "message": "Celery worker可能未启动或无响应",
        }


@router.get("/health/system", summary="系统健康检查")
async def system_health_check(async_mode: bool = Query(False, description="是否异步执行")):
    """
    检查系统各组件健康状态
    """
    try:
        if async_mode:
            result = health_check.delay()
            return {
                "task_id": result.id,
                "status": "queued",
            }
        else:
            result = health_check.delay().get(timeout=30)
            return result
    except Exception as e:
        logger.error(f"系统健康检查失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/test-alert", summary="测试告警通道")
async def test_alert(
    level: AlertLevel = Query(AlertLevel.INFO, description="告警级别"),
    title: str = Query("测试告警", description="告警标题"),
    content: str = Query("这是一条测试告警消息", description="告警内容"),
):
    """
    测试告警通道是否正常工作
    """
    from sync_crm.infrastructure.alerting import get_alert_notifier

    try:
        notifier = get_alert_notifier()
        results = notifier.send_alert(
            title=title,
            content=content,
            level=level,
        )

        return {
            "level": level,
            "title": title,
            "channels": results,
            "success_count": sum(1 for v in results.values() if v),
            "failed_count": sum(1 for v in results.values() if not v),
        }
    except Exception as e:
        logger.error(f"测试告警失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/active-workers", summary="获取活跃Worker列表")
async def get_active_workers():
    """
    获取当前活跃的Celery Worker列表
    """
    from sync_crm.tasks.celery_app import app as celery_app

    try:
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        active_tasks = inspect.active()
        scheduled_tasks = inspect.scheduled()
        reserved_tasks = inspect.reserved()

        workers = {}
        if stats:
            for worker_name, worker_stats in stats.items():
                workers[worker_name] = {
                    "status": "online",
                    "pid": worker_stats.get("pid"),
                    "concurrency": worker_stats.get("pool", {}).get("max-concurrency"),
                    "processed_tasks": worker_stats.get("total", {}),
                    "active_tasks": active_tasks.get(worker_name, []) if active_tasks else [],
                    "scheduled_tasks": scheduled_tasks.get(worker_name, []) if scheduled_tasks else [],
                    "reserved_tasks": reserved_tasks.get(worker_name, []) if reserved_tasks else [],
                }

        return {
            "total_workers": len(workers),
            "workers": workers,
        }
    except Exception as e:
        logger.error(f"获取活跃Worker列表失败: {e}", exc_info=True)
        return {
            "total_workers": 0,
            "workers": {},
            "error": str(e),
            "message": "无法获取Worker信息，请检查Celery是否启动",
        }
