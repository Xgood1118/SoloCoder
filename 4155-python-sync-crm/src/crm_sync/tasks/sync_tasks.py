from datetime import datetime
from typing import Any, Dict

from loguru import logger

from crm_sync.infrastructure import get_db_session
from crm_sync.infrastructure.redis_client import get_redis_client
from crm_sync.services import (
    CustomerSyncService,
    ContactSyncService,
    LeadSyncService,
    OrderSyncService,
)
from .celery_app import celery_app


def acquire_sync_lock(task_name: str, timeout: int = 300) -> bool:
    redis = get_redis_client()
    lock_key = f"sync:lock:{task_name}"
    return redis.acquire_lock(lock_key, timeout)


def release_sync_lock(task_name: str) -> None:
    redis = get_redis_client()
    lock_key = f"sync:lock:{task_name}"
    redis.release_lock(lock_key)


def update_sync_status(entity_type: str, status: Dict[str, Any]) -> None:
    redis = get_redis_client()
    status_key = f"sync:status:{entity_type}"
    status["last_updated"] = datetime.utcnow().isoformat()
    redis.set(status_key, status, expire=3600)


@celery_app.task(bind=True, name="crm_sync.tasks.sync_customer_incremental")
def sync_customer_incremental(self) -> Dict[str, Any]:
    task_name = "customer_incremental"
    if not acquire_sync_lock(task_name):
        logger.warning(f"Sync task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        with get_db_session() as db:
            service = CustomerSyncService(db_session=db)
            result = service.sync_incremental()

            update_sync_status(
                "customer",
                {
                    "status": "completed",
                    "success_count": result.context.success_count,
                    "failed_count": result.context.failed_count,
                    "duration_ms": result.context.get_duration_ms(),
                },
            )

            return {
                "status": "completed",
                "success": result.success,
                "success_count": result.context.success_count,
                "failed_count": result.context.failed_count,
                "skipped_count": result.context.skipped_count,
                "duration_ms": result.context.get_duration_ms(),
                "message": result.message,
            }
    except Exception as e:
        logger.error(f"Customer incremental sync failed: {e}", exc_info=True)
        update_sync_status("customer", {"status": "failed", "error": str(e)})
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.sync_customer_full")
def sync_customer_full(self) -> Dict[str, Any]:
    task_name = "customer_full"
    if not acquire_sync_lock(task_name, timeout=3600):
        logger.warning(f"Sync task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        with get_db_session() as db:
            service = CustomerSyncService(db_session=db)
            result = service.sync_full()

            return {
                "status": "completed",
                "success": result.success,
                "success_count": result.context.success_count,
                "failed_count": result.context.failed_count,
                "duration_ms": result.context.get_duration_ms(),
                "message": result.message,
            }
    except Exception as e:
        logger.error(f"Customer full sync failed: {e}", exc_info=True)
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.sync_contact_incremental")
def sync_contact_incremental(self) -> Dict[str, Any]:
    task_name = "contact_incremental"
    if not acquire_sync_lock(task_name):
        logger.warning(f"Sync task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        with get_db_session() as db:
            service = ContactSyncService(db_session=db)
            result = service.sync_incremental()

            update_sync_status(
                "contact",
                {
                    "status": "completed",
                    "success_count": result.context.success_count,
                    "failed_count": result.context.failed_count,
                    "duration_ms": result.context.get_duration_ms(),
                },
            )

            return {
                "status": "completed",
                "success": result.success,
                "success_count": result.context.success_count,
                "failed_count": result.context.failed_count,
                "duration_ms": result.context.get_duration_ms(),
                "message": result.message,
            }
    except Exception as e:
        logger.error(f"Contact incremental sync failed: {e}", exc_info=True)
        update_sync_status("contact", {"status": "failed", "error": str(e)})
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.sync_contact_full")
def sync_contact_full(self) -> Dict[str, Any]:
    task_name = "contact_full"
    if not acquire_sync_lock(task_name, timeout=3600):
        logger.warning(f"Sync task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        with get_db_session() as db:
            service = ContactSyncService(db_session=db)
            result = service.sync_full()

            return {
                "status": "completed",
                "success": result.success,
                "success_count": result.context.success_count,
                "failed_count": result.context.failed_count,
                "duration_ms": result.context.get_duration_ms(),
                "message": result.message,
            }
    except Exception as e:
        logger.error(f"Contact full sync failed: {e}", exc_info=True)
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.sync_lead_incremental")
def sync_lead_incremental(self) -> Dict[str, Any]:
    task_name = "lead_incremental"
    if not acquire_sync_lock(task_name):
        logger.warning(f"Sync task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        with get_db_session() as db:
            service = LeadSyncService(db_session=db)
            result = service.sync_incremental()

            update_sync_status(
                "lead",
                {
                    "status": "completed",
                    "success_count": result.context.success_count,
                    "failed_count": result.context.failed_count,
                    "duration_ms": result.context.get_duration_ms(),
                },
            )

            return {
                "status": "completed",
                "success": result.success,
                "success_count": result.context.success_count,
                "failed_count": result.context.failed_count,
                "duration_ms": result.context.get_duration_ms(),
                "message": result.message,
            }
    except Exception as e:
        logger.error(f"Lead incremental sync failed: {e}", exc_info=True)
        update_sync_status("lead", {"status": "failed", "error": str(e)})
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.sync_lead_full")
def sync_lead_full(self) -> Dict[str, Any]:
    task_name = "lead_full"
    if not acquire_sync_lock(task_name, timeout=3600):
        logger.warning(f"Sync task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        with get_db_session() as db:
            service = LeadSyncService(db_session=db)
            result = service.sync_full()

            return {
                "status": "completed",
                "success": result.success,
                "success_count": result.context.success_count,
                "failed_count": result.context.failed_count,
                "duration_ms": result.context.get_duration_ms(),
                "message": result.message,
            }
    except Exception as e:
        logger.error(f"Lead full sync failed: {e}", exc_info=True)
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.sync_order_incremental")
def sync_order_incremental(self) -> Dict[str, Any]:
    task_name = "order_incremental"
    if not acquire_sync_lock(task_name):
        logger.warning(f"Sync task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        with get_db_session() as db:
            service = OrderSyncService(db_session=db)
            result = service.sync_incremental()

            update_sync_status(
                "order",
                {
                    "status": "completed",
                    "success_count": result.context.success_count,
                    "failed_count": result.context.failed_count,
                    "duration_ms": result.context.get_duration_ms(),
                },
            )

            return {
                "status": "completed",
                "success": result.success,
                "success_count": result.context.success_count,
                "failed_count": result.context.failed_count,
                "duration_ms": result.context.get_duration_ms(),
                "message": result.message,
            }
    except Exception as e:
        logger.error(f"Order incremental sync failed: {e}", exc_info=True)
        update_sync_status("order", {"status": "failed", "error": str(e)})
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.sync_order_full")
def sync_order_full(self) -> Dict[str, Any]:
    task_name = "order_full"
    if not acquire_sync_lock(task_name, timeout=3600):
        logger.warning(f"Sync task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        with get_db_session() as db:
            service = OrderSyncService(db_session=db)
            result = service.sync_full()

            return {
                "status": "completed",
                "success": result.success,
                "success_count": result.context.success_count,
                "failed_count": result.context.failed_count,
                "duration_ms": result.context.get_duration_ms(),
                "message": result.message,
            }
    except Exception as e:
        logger.error(f"Order full sync failed: {e}", exc_info=True)
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.check_data_consistency")
def check_data_consistency(self) -> Dict[str, Any]:
    task_name = "data_consistency_check"
    if not acquire_sync_lock(task_name, timeout=7200):
        logger.warning(f"Task {task_name} is already running, skipping")
        return {"status": "skipped", "reason": "lock_acquired"}

    try:
        results = {}
        entity_types = ["customer", "contact", "lead", "order"]

        with get_db_session() as db:
            for entity_type in entity_types:
                from crm_sync.services.base_sync import BaseSyncService

                service = BaseSyncService(entity_type=entity_type, db_session=db)
                inconsistencies = service.check_data_consistency(limit=100)
                results[entity_type] = {
                    "checked": 100,
                    "inconsistencies": len(inconsistencies),
                    "details": inconsistencies[:10],
                }

        return {
            "status": "completed",
            "results": results,
            "total_inconsistencies": sum(
                r["inconsistencies"] for r in results.values()
            ),
        }
    except Exception as e:
        logger.error(f"Data consistency check failed: {e}", exc_info=True)
        raise
    finally:
        release_sync_lock(task_name)


@celery_app.task(bind=True, name="crm_sync.tasks.run_full_sync_all")
def run_full_sync_all(self) -> Dict[str, Any]:
    logger.info("Starting full sync for all entities")

    results = {}

    sync_order = [
        ("customer", sync_customer_full),
        ("contact", sync_contact_full),
        ("lead", sync_lead_full),
        ("order", sync_order_full),
    ]

    for entity, task in sync_order:
        try:
            result = task.apply()
            results[entity] = result.get()
        except Exception as e:
            logger.error(f"Full sync for {entity} failed: {e}", exc_info=True)
            results[entity] = {"status": "failed", "error": str(e)}

    return {"status": "completed", "results": results}
