"""
Celery应用配置
"""
from celery import Celery
from celery.schedules import crontab
from typing import Dict, Any

from sync_crm.config import settings
from sync_crm.infrastructure.logging import get_logger

logger = get_logger(__name__)


def make_celery() -> Celery:
    """创建Celery应用实例"""
    app = Celery(
        "crm_sync",
        broker=settings.redis.url,
        backend=settings.redis.url,
        include=[
            "sync_crm.tasks.sync_tasks",
            "sync_crm.tasks.monitor_tasks",
        ],
    )

    app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone=settings.sync.timezone,
        enable_utc=settings.sync.utc_storage,
        task_track_started=True,
        task_time_limit=3600,
        task_soft_time_limit=3300,
        worker_prefetch_multiplier=1,
        worker_max_tasks_per_child=1000,
        worker_send_task_events=True,
        task_send_sent_event=True,
        result_expires=86400,
        broker_connection_retry_on_startup=True,
        broker_connection_max_retries=10,
        broker_connection_timeout=30,
        broker_pool_limit=10,
    )

    app.conf.beat_schedule = _build_beat_schedule()

    return app


def _build_beat_schedule() -> Dict[str, Any]:
    """构建定时任务调度表"""
    schedule = settings.schedule

    beat_schedule = {
        "sync-customers-incremental": {
            "task": "sync_crm.tasks.sync_tasks.sync_customers_incremental",
            "schedule": crontab.from_string(schedule.customer_cron),
            "args": (),
            "kwargs": {"sync_source": "scheduler"},
            "options": {"queue": "sync_tasks", "priority": 5},
        },
        "sync-contacts-incremental": {
            "task": "sync_crm.tasks.sync_tasks.sync_contacts_incremental",
            "schedule": crontab.from_string(schedule.contact_cron),
            "args": (),
            "kwargs": {"sync_source": "scheduler"},
            "options": {"queue": "sync_tasks", "priority": 5},
        },
        "sync-leads-incremental": {
            "task": "sync_crm.tasks.sync_tasks.sync_leads_incremental",
            "schedule": crontab.from_string(schedule.lead_cron),
            "args": (),
            "kwargs": {"sync_source": "scheduler"},
            "options": {"queue": "sync_tasks", "priority": 6},
        },
        "sync-orders-incremental": {
            "task": "sync_crm.tasks.sync_tasks.sync_orders_incremental",
            "schedule": crontab.from_string(schedule.order_cron),
            "args": (),
            "kwargs": {"sync_source": "scheduler"},
            "options": {"queue": "sync_tasks", "priority": 4},
        },
        "check-sync-delay": {
            "task": "sync_crm.tasks.monitor_tasks.check_sync_delay",
            "schedule": crontab.from_string(schedule.monitor_cron),
            "args": (),
            "options": {"queue": "monitor", "priority": 8},
        },
        "check-data-consistency": {
            "task": "sync_crm.tasks.monitor_tasks.check_data_consistency",
            "schedule": crontab.from_string(schedule.consistency_check_cron),
            "args": (),
            "options": {"queue": "monitor", "priority": 3},
        },
    }

    return beat_schedule


app = make_celery()


@app.task(bind=True, name="sync_crm.tasks.ping")
def ping(self):
    """健康检查任务"""
    return {"status": "ok", "task_id": self.request.id}


@app.task(bind=True, name="sync_crm.tasks.health_check")
def health_check(self):
    """系统健康检查"""
    from sync_crm.infrastructure.database import engine
    from sync_crm.infrastructure.distributed_lock import get_redis_client

    results = {}

    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        results["database"] = "ok"
    except Exception as e:
        results["database"] = f"error: {e}"

    try:
        redis = get_redis_client()
        redis.ping()
        results["redis"] = "ok"
    except Exception as e:
        results["redis"] = f"error: {e}"

    return results
