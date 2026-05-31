from sync_crm.tasks.celery_app import app as celery_app
from sync_crm.tasks import sync_tasks, monitor_tasks

__all__ = ["celery_app", "sync_tasks", "monitor_tasks"]
