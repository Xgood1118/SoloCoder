from datetime import datetime, timedelta
from typing import Dict, List, Optional

from loguru import logger

from crm_sync.config import get_settings
from crm_sync.infrastructure import get_db_session
from crm_sync.infrastructure.redis_client import get_redis_client
from crm_sync.models import SyncLog, SyncStatus
from .alert import get_alert_service


class SyncDelayAlert:
    def __init__(self, entity_type: str, delay_minutes: int, threshold_minutes: int):
        self.entity_type = entity_type
        self.delay_minutes = delay_minutes
        self.threshold_minutes = threshold_minutes
        self.alert_time = datetime.utcnow()


class DelayMonitor:
    def __init__(self):
        self.settings = get_settings()
        self.threshold_minutes = self.settings.sync.max_delay_minutes
        self.alert_service = get_alert_service()
        self.redis = get_redis_client()
        self._alert_cooldown_key = "sync:alert:cooldown"

    def check_all_delays(self) -> List[SyncDelayAlert]:
        alerts = []
        entity_types = ["customer", "contact", "lead", "order"]

        for entity_type in entity_types:
            alert = self.check_entity_delay(entity_type)
            if alert:
                alerts.append(alert)

        return alerts

    def check_entity_delay(self, entity_type: str) -> Optional[SyncDelayAlert]:
        try:
            last_sync_time = self._get_last_success_sync_time(entity_type)
            if not last_sync_time:
                logger.warning(f"No successful sync found for {entity_type}")
                return None

            now = datetime.utcnow()
            delay_minutes = int((now - last_sync_time).total_seconds() / 60)

            if delay_minutes > self.threshold_minutes:
                logger.warning(
                    f"Sync delay detected for {entity_type}: "
                    f"{delay_minutes} minutes (threshold: {self.threshold_minutes})"
                )

                if self._should_alert(entity_type):
                    self.alert_service.alert_sync_delay(
                        entity_type, delay_minutes, self.threshold_minutes
                    )
                    self._record_alert(entity_type)

                    return SyncDelayAlert(
                        entity_type=entity_type,
                        delay_minutes=delay_minutes,
                        threshold_minutes=self.threshold_minutes,
                    )

            return None
        except Exception as e:
            logger.error(f"Failed to check delay for {entity_type}: {e}")
            return None

    def _get_last_success_sync_time(self, entity_type: str) -> Optional[datetime]:
        try:
            with get_db_session() as db:
                last_log = (
                    db.query(SyncLog)
                    .filter(
                        SyncLog.entity_type == entity_type,
                        SyncLog.status == SyncStatus.SUCCESS,
                    )
                    .order_by(SyncLog.created_at.desc())
                    .first()
                )
                return last_log.end_time if last_log else None
        except Exception as e:
            logger.error(f"Failed to get last sync time: {e}")
            return None

    def _should_alert(self, entity_type: str) -> bool:
        cooldown_key = f"{self._alert_cooldown_key}:{entity_type}"
        if self.redis.exists(cooldown_key):
            return False
        return True

    def _record_alert(self, entity_type: str) -> None:
        cooldown_key = f"{self._alert_cooldown_key}:{entity_type}"
        self.redis.set(cooldown_key, "1", expire=3600)

    def get_sync_status_summary(self) -> Dict[str, Any]:
        summary = {}
        entity_types = ["customer", "contact", "lead", "order"]

        for entity_type in entity_types:
            last_sync_time = self._get_last_success_sync_time(entity_type)
            delay_minutes = None
            if last_sync_time:
                delay_minutes = int((datetime.utcnow() - last_sync_time).total_seconds() / 60)

            summary[entity_type] = {
                "last_sync_time": last_sync_time.isoformat() if last_sync_time else None,
                "delay_minutes": delay_minutes,
                "threshold_minutes": self.threshold_minutes,
                "is_delayed": delay_minutes > self.threshold_minutes if delay_minutes else False,
            }

        return {
            "threshold_minutes": self.threshold_minutes,
            "entities": summary,
            "checked_at": datetime.utcnow().isoformat(),
        }


_delay_monitor: Optional[DelayMonitor] = None


def get_delay_monitor() -> DelayMonitor:
    global _delay_monitor
    if _delay_monitor is None:
        _delay_monitor = DelayMonitor()
    return _delay_monitor
