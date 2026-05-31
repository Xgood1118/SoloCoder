"""
监控任务定义
包含同步延迟检查、数据一致性校验等监控任务
"""
from typing import Any, Dict, List

from celery import states
from celery.exceptions import SoftTimeLimitExceeded

from sync_crm.tasks.celery_app import app
from sync_crm.infrastructure.database import get_db_context
from sync_crm.infrastructure.logging import get_logger
from sync_crm.infrastructure.alerting import get_alert_notifier, AlertLevel
from sync_crm.infrastructure.distributed_lock import distributed_lock
from sync_crm.config import settings
from sync_crm.models.mapping import EntityType, SyncMapping, MappingStatus
from sync_crm.models.sync_log import SyncLog, TaskStatus, OperationType
from sync_crm.services.customer_sync import CustomerSyncService
from sync_crm.services.contact_sync import ContactSyncService
from sync_crm.services.lead_sync import LeadSyncService
from sync_crm.services.order_sync import OrderSyncService
from sync_crm.pipeline.verifier import DataConsistencyVerifier

logger = get_logger(__name__)
alert_notifier = get_alert_notifier()


_alert_cooldowns: Dict[str, float] = {}


def _check_alert_cooldown(alert_key: str, cooldown_seconds: int = 600) -> bool:
    """
    检查告警冷却，避免告警风暴

    Args:
        alert_key: 告警唯一标识
        cooldown_seconds: 冷却时间(秒)

    Returns:
        True表示可以发送告警，False表示在冷却期内
    """
    import time

    now = time.time()
    last_sent = _alert_cooldowns.get(alert_key, 0)

    if now - last_sent < cooldown_seconds:
        logger.debug(f"告警[{alert_key}]在冷却期内，跳过发送")
        return False

    _alert_cooldowns[alert_key] = now
    return True


@app.task(
    bind=True,
    name="sync_crm.tasks.check_sync_delay",
    queue="monitor",
    priority=8,
    time_limit=600,
    soft_time_limit=540,
)
def check_sync_delay(self):
    """
    检查各实体的同步延迟
    如果延迟超过阈值，触发告警
    """
    task_id = self.request.id
    logger.info(f"开始检查同步延迟, task_id={task_id}")

    self.update_state(state=states.STARTED, meta={"status": "running"})

    results = {}
    threshold = settings.sync.sync_delay_threshold

    try:
        with get_db_context() as db:
            services = [
                (EntityType.CUSTOMER, CustomerSyncService(db)),
                (EntityType.CONTACT, ContactSyncService(db)),
                (EntityType.LEAD, LeadSyncService(db)),
                (EntityType.ORDER, OrderSyncService(db)),
            ]

            for entity_type, service in services:
                is_over, delay = service.check_delay()
                results[entity_type.value] = {
                    "is_over_threshold": is_over,
                    "delay_seconds": delay,
                    "threshold_seconds": threshold,
                }

                if is_over:
                    alert_key = f"sync_delay:{entity_type.value}"
                    if _check_alert_cooldown(alert_key, cooldown_seconds=600):
                        alert_notifier.notify_sync_delay(
                            entity_type=entity_type.value,
                            delay_seconds=delay,
                            threshold_seconds=threshold,
                        )

        self.update_state(
            state=states.SUCCESS,
            meta={"status": "completed", "results": results},
        )

        logger.info(f"同步延迟检查完成, task_id={task_id}, results={results}")
        return results

    except SoftTimeLimitExceeded:
        error_msg = f"同步延迟检查超时, task_id={task_id}"
        logger.error(error_msg)
        self.update_state(state=states.FAILURE, meta={"error": error_msg})
        raise

    except Exception as e:
        error_msg = f"同步延迟检查异常: {e}"
        logger.error(error_msg, exc_info=True)

        alert_key = "monitor:delay_check_error"
        if _check_alert_cooldown(alert_key, cooldown_seconds=1800):
            alert_notifier.notify_system_error(
                component="sync_delay_check",
                error=str(e),
            )

        self.update_state(state=states.FAILURE, meta={"error": error_msg})
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.check_data_consistency",
    queue="monitor",
    priority=3,
    time_limit=14400,
    soft_time_limit=14100,
)
def check_data_consistency(self):
    """
    全量数据一致性检查
    定期对比CRM和营销平台的数据是否一致
    """
    task_id = self.request.id
    logger.info(f"开始数据一致性检查, task_id={task_id}")

    self.update_state(state=states.STARTED, meta={"status": "running"})

    lock_key = "monitor:data_consistency_check"

    try:
        with distributed_lock(lock_key, timeout=14400, acquire_timeout=60):
            results = {}

            with get_db_context() as db:
                entity_types = [
                    (EntityType.CUSTOMER, CustomerSyncService(db)),
                    (EntityType.CONTACT, ContactSyncService(db)),
                    (EntityType.LEAD, LeadSyncService(db)),
                    (EntityType.ORDER, OrderSyncService(db)),
                ]

                for entity_type, service in entity_types:
                    logger.info(f"开始检查[{entity_type.value}]数据一致性")

                    try:
                        verifier = DataConsistencyVerifier(
                            entity_type=entity_type,
                            source_adapter=service.crm_adapter,
                            target_adapter=service.marketing_adapter,
                            db_session=db,
                        )

                        check_result = verifier.check_all()
                        results[entity_type.value] = check_result

                        consistency_score = check_result.get("consistency_score", 1.0)
                        inconsistent_count = check_result.get("inconsistent_count", 0)
                        samples = check_result.get("samples", [])

                        logger.info(
                            f"[{entity_type.value}]一致性检查完成: "
                            f"score={consistency_score:.2f}, "
                            f"inconsistent={inconsistent_count}"
                        )

                        if inconsistent_count > 0:
                            alert_key = f"consistency:{entity_type.value}"
                            if _check_alert_cooldown(alert_key, cooldown_seconds=3600):
                                alert_notifier.notify_consistency_issue(
                                    entity_type=entity_type.value,
                                    inconsistent_count=inconsistent_count,
                                    samples=samples,
                                )

                    except Exception as e:
                        logger.error(
                            f"[{entity_type.value}]一致性检查失败: {e}",
                            exc_info=True,
                        )
                        results[entity_type.value] = {
                            "error": type(e).__name__,
                            "error_detail": str(e),
                        }

                        alert_key = f"consistency_error:{entity_type.value}"
                        if _check_alert_cooldown(alert_key, cooldown_seconds=3600):
                            alert_notifier.notify_system_error(
                                component=f"consistency_check:{entity_type.value}",
                                error=str(e),
                            )

            self.update_state(
                state=states.SUCCESS,
                meta={"status": "completed", "results": results},
            )

            logger.info(f"数据一致性检查完成, task_id={task_id}")
            return results

    except RuntimeError as e:
        if "无法获取分布式锁" in str(e):
            logger.warning(f"数据一致性检查已有任务在运行，跳过本次执行")
            return {"status": "skipped", "reason": "another_task_running"}
        raise

    except SoftTimeLimitExceeded:
        error_msg = f"数据一致性检查超时, task_id={task_id}"
        logger.error(error_msg)
        self.update_state(state=states.FAILURE, meta={"error": error_msg})
        raise

    except Exception as e:
        error_msg = f"数据一致性检查异常: {e}"
        logger.error(error_msg, exc_info=True)

        alert_key = "monitor:consistency_check_error"
        if _check_alert_cooldown(alert_key, cooldown_seconds=1800):
            alert_notifier.notify_system_error(
                component="data_consistency_check",
                error=str(e),
            )

        self.update_state(state=states.FAILURE, meta={"error": error_msg})
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.get_sync_statistics",
    queue="monitor",
    priority=5,
    time_limit=300,
    soft_time_limit=270,
)
def get_sync_statistics(self, days: int = 7):
    """
    获取同步统计数据

    Args:
        days: 统计天数
    """
    from datetime import datetime, timedelta

    task_id = self.request.id
    logger.info(f"开始获取同步统计数据, days={days}, task_id={task_id}")

    try:
        with get_db_context() as db:
            start_date = datetime.utcnow() - timedelta(days=days)

            stats = db.query(SyncLog).filter(SyncLog.created_at >= start_date)

            summary = {
                "total_tasks": stats.count(),
                "success_tasks": stats.filter(SyncLog.status == TaskStatus.SUCCESS).count(),
                "failed_tasks": stats.filter(SyncLog.status == TaskStatus.FAILED).count(),
                "partial_tasks": stats.filter(SyncLog.status == TaskStatus.PARTIAL).count(),
                "running_tasks": stats.filter(SyncLog.status == TaskStatus.RUNNING).count(),
            }

            by_entity = {}
            for entity_type in EntityType:
                entity_stats = stats.filter(SyncLog.entity_type == entity_type)
                by_entity[entity_type.value] = {
                    "total": entity_stats.count(),
                    "success": entity_stats.filter(SyncLog.status == TaskStatus.SUCCESS).count(),
                    "failed": entity_stats.filter(SyncLog.status == TaskStatus.FAILED).count(),
                    "total_records": entity_stats.with_entities(
                        db.func.sum(SyncLog.record_count)
                    ).scalar() or 0,
                    "total_duration_ms": entity_stats.with_entities(
                        db.func.sum(SyncLog.duration_ms)
                    ).scalar() or 0,
                }

            by_operation = {}
            for op_type in OperationType:
                op_stats = stats.filter(SyncLog.operation_type == op_type)
                by_operation[op_type.value] = {
                    "total": op_stats.count(),
                    "success": op_stats.filter(SyncLog.status == TaskStatus.SUCCESS).count(),
                }

            recent_failures = (
                stats.filter(SyncLog.status == TaskStatus.FAILED)
                .order_by(SyncLog.finished_at.desc())
                .limit(10)
                .all()
            )

            result = {
                "period_days": days,
                "summary": summary,
                "by_entity": by_entity,
                "by_operation": by_operation,
                "recent_failures": [log.to_dict() for log in recent_failures],
            }

            logger.info(f"同步统计数据获取完成, task_id={task_id}")
            return result

    except Exception as e:
        logger.error(f"获取同步统计数据失败: {e}", exc_info=True)
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.get_mapping_statistics",
    queue="monitor",
    priority=5,
    time_limit=300,
    soft_time_limit=270,
)
def get_mapping_statistics(self):
    """
    获取映射表统计数据
    """
    task_id = self.request.id
    logger.info(f"开始获取映射表统计数据, task_id={task_id}")

    try:
        with get_db_context() as db:
            result = {}

            for entity_type in EntityType:
                mappings = db.query(SyncMapping).filter(
                    SyncMapping.entity_type == entity_type
                )

                result[entity_type.value] = {
                    "total": mappings.count(),
                    "active": mappings.filter(
                        SyncMapping.status == MappingStatus.ACTIVE
                    ).count(),
                    "deleted": mappings.filter(
                        SyncMapping.status == MappingStatus.DELETED
                    ).count(),
                    "conflict": mappings.filter(
                        SyncMapping.status == MappingStatus.CONFLICT
                    ).count(),
                }

            logger.info(f"映射表统计数据获取完成, task_id={task_id}")
            return result

    except Exception as e:
        logger.error(f"获取映射表统计数据失败: {e}", exc_info=True)
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.clean_old_logs",
    queue="monitor",
    priority=2,
    time_limit=3600,
    soft_time_limit=3300,
)
def clean_old_logs(self, keep_days: int = 30):
    """
    清理旧的同步日志

    Args:
        keep_days: 保留天数
    """
    from datetime import datetime, timedelta

    task_id = self.request.id
    logger.info(f"开始清理旧日志, keep_days={keep_days}, task_id={task_id}")

    try:
        with get_db_context() as db:
            cutoff_date = datetime.utcnow() - timedelta(days=keep_days)

            old_logs = db.query(SyncLog).filter(SyncLog.created_at < cutoff_date)
            count = old_logs.count()

            old_logs.delete(synchronize_session=False)
            db.commit()

            logger.info(f"清理完成, 删除{count}条旧日志, task_id={task_id}")

            return {"deleted_count": count, "keep_days": keep_days}

    except Exception as e:
        logger.error(f"清理旧日志失败: {e}", exc_info=True)
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.send_daily_report",
    queue="monitor",
    priority=4,
    time_limit=600,
    soft_time_limit=540,
)
def send_daily_report(self):
    """
    发送每日同步报告
    """
    task_id = self.request.id
    logger.info(f"开始发送每日同步报告, task_id={task_id}")

    try:
        stats = get_sync_statistics.delay(days=1).get(timeout=300)
        mapping_stats = get_mapping_statistics.delay().get(timeout=300)

        report_lines = ["## CRM同步服务 - 每日报告\n"]

        summary = stats.get("summary", {})
        report_lines.append(
            f"- 总任务数: {summary.get('total_tasks', 0)}\n"
            f"- 成功: {summary.get('success_tasks', 0)}\n"
            f"- 失败: {summary.get('failed_tasks', 0)}\n"
            f"- 部分成功: {summary.get('partial_tasks', 0)}\n"
        )

        report_lines.append("\n### 各实体同步情况\n")
        for entity, data in stats.get("by_entity", {}).items():
            report_lines.append(
                f"**{entity}**: 总数={data.get('total', 0)}, "
                f"成功={data.get('success', 0)}, "
                f"总记录={data.get('total_records', 0)}, "
                f"总耗时={(data.get('total_duration_ms', 0) / 1000):.2f}秒\n"
            )

        report_lines.append("\n### 映射表统计\n")
        for entity, data in mapping_stats.items():
            report_lines.append(
                f"**{entity}**: 总数={data.get('total', 0)}, "
                f"活跃={data.get('active', 0)}, "
                f"冲突={data.get('conflict', 0)}\n"
            )

        recent_failures = stats.get("recent_failures", [])
        if recent_failures:
            report_lines.append("\n### 最近失败任务\n")
            for failure in recent_failures[:5]:
                report_lines.append(
                    f"- [{failure.get('entity_type')}] {failure.get('operation_type')}: "
                    f"{failure.get('error_detail', '未知错误')}\n"
                )

        content = "".join(report_lines)

        alert_notifier.send_alert(
            title="CRM同步服务 - 每日报告",
            content=content,
            level=AlertLevel.INFO,
        )

        logger.info(f"每日报告发送完成, task_id={task_id}")
        return {"status": "sent"}

    except Exception as e:
        logger.error(f"发送每日报告失败: {e}", exc_info=True)
        raise
