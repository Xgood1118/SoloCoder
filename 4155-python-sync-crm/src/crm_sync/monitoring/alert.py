from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

from crm_sync.config import get_settings


class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertChannel(str, Enum):
    WECHAT_WORK = "wechat_work"
    DINGTALK = "dingtalk"
    EMAIL = "email"


class AlertService:
    def __init__(self):
        self.settings = get_settings()
        self.webhook_url = self.settings.alert.webhook_url
        self.enabled = self.settings.alert.enabled

    def send_alert(
        self,
        title: str,
        message: str,
        level: AlertLevel = AlertLevel.ERROR,
        channel: AlertChannel = AlertChannel.WECHAT_WORK,
        details: Optional[Dict[str, Any]] = None,
    ) -> bool:
        if not self.enabled or not self.webhook_url:
            logger.warning(f"Alert disabled: {title} - {message}")
            return False

        try:
            formatted_message = self._format_message(title, message, level, details)

            if channel == AlertChannel.WECHAT_WORK:
                return self._send_wechat_work(formatted_message)
            elif channel == AlertChannel.DINGTALK:
                return self._send_dingtalk(formatted_message)

            return True
        except Exception as e:
            logger.error(f"Failed to send alert: {e}")
            return False

    def _format_message(
        self,
        title: str,
        message: str,
        level: AlertLevel,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        level_emojis = {
            AlertLevel.INFO: "ℹ️",
            AlertLevel.WARNING: "⚠️",
            AlertLevel.ERROR: "❌",
            AlertLevel.CRITICAL: "🚨",
        }

        content = f"{level_emojis.get(level, '')} {title}\n\n"
        content += f"**时间**: {datetime.now().isoformat()}\n"
        content += f"**级别**: {level.value}\n\n"
        content += f"{message}\n\n"

        if details:
            content += "**详情**:\n"
            for key, value in details.items():
                content += f"- {key}: {value}\n"

        return {
            "msgtype": "markdown",
            "markdown": {
                "content": content
                }
            }

    def _send_wechat_work(self, message: Dict[str, Any]) -> bool:
        try:
            with httpx.Client() as client:
                response = client.post(
                    self.webhook_url,
                    json=message,
                    timeout=10,
                )
                result = response.json()
                return result.get("errcode") == 0
        except Exception as e:
            logger.error(f"Failed to send WeChat Work alert: {e}")
            return False

    def _send_dingtalk(self, message: Dict[str, Any]) -> bool:
        try:
            dingtalk_message = {
                "msgtype": "markdown",
                "markdown": {
                    "title": "CRM同步告警",
                    "text": message["markdown"]["content"],
                },
            }
            with httpx.Client() as client:
                response = client.post(
                    self.webhook_url,
                    json=dingtalk_message,
                    timeout=10,
                )
                result = response.json()
                return result.get("errcode") == 0
        except Exception as e:
            logger.error(f"Failed to send DingTalk alert: {e}")
            return False

    def alert_sync_failure(
        self,
        entity_type: str,
        error_message: str,
        failed_count: int = 0,
    ) -> bool:
        return self.send_alert(
            title=f"CRM同步失败 - {entity_type}",
            message=f"同步过程中发生错误",
            level=AlertLevel.ERROR,
            details={
                "实体类型": entity_type,
                "失败数量": failed_count,
                "错误信息": error_message,
            },
        )

    def alert_sync_delay(
        self,
        entity_type: str,
        delay_minutes: int,
        threshold_minutes: int,
    ) -> bool:
        return self.send_alert(
            title=f"CRM同步延迟告警 - {entity_type}",
            message=f"数据同步延迟超过阈值",
            level=AlertLevel.WARNING,
            details={
                "实体类型": entity_type,
                "当前延迟": f"{delay_minutes}分钟",
                "告警阈值": f"{threshold_minutes}分钟",
            },
        )

    def alert_data_inconsistency(
        self,
        entity_type: str,
        inconsistent_count: int,
    ) -> bool:
        return self.send_alert(
            title=f"CRM数据不一致告警 - {entity_type}",
            message=f"检测到数据不一致",
            level=AlertLevel.WARNING,
            details={
                "实体类型": entity_type,
                "不一致数量": inconsistent_count,
            },
        )

    def notify_sync_summary(
        self,
        summary: Dict[str, Any],
    ) -> bool:
        return self.send_alert(
            title="CRM同步完成通知",
            message="全量同步任务已完成",
            level=AlertLevel.INFO,
            details=summary,
        )


_alert_service: Optional[AlertService] = None


def get_alert_service() -> AlertService:
    global _alert_service
    if _alert_service is None:
        _alert_service = AlertService()
    return _alert_service
