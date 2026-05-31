from celery import Celery
from celery.schedules import crontab

from crm_sync.config import get_settings

settings = get_settings()

celery_app = Celery(
    "crm_sync_tasks",
    broker=settings.celery.broker_url,
    backend=settings.celery.result_backend,
)

celery_app.conf.update(
    task_serializer=settings.celery.task_serializer,
    result_serializer=settings.celery.result_serializer,
    accept_content=settings.celery.accept_content,
    timezone=settings.celery.timezone,
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    task_soft_time_limit=3300,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

celery_app.conf.beat_schedule = {
    "sync-customer-every-5-minutes": {
        "task": "crm_sync.tasks.sync_customer_incremental",
        "schedule": crontab(minute="*/5"),
    },
    "sync-contact-every-5-minutes": {
        "task": "crm_sync.tasks.sync_contact_incremental",
        "schedule": crontab(minute="*/5"),
    },
    "sync-lead-every-2-minutes": {
        "task": "crm_sync.tasks.sync_lead_incremental",
        "schedule": crontab(minute="*/2"),
    },
    "sync-order-every-10-minutes": {
        "task": "crm_sync.tasks.sync_order_incremental",
        "schedule": crontab(minute="*/10"),
    },
    "check-data-consistency-daily": {
        "task": "crm_sync.tasks.check_data_consistency",
        "schedule": crontab(hour=2, minute=0),
    },
}

celery_app.autodiscover_tasks(["crm_sync.tasks"])
