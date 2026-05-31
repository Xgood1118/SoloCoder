"""
告警通知模块
支持钉钉、企业微信、邮件等多种告警渠道
"""
import json
import smtplib
import ssl
from abc import ABC, abstractmethod
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

import httpx

from sync_crm.config import settings
from sync_crm.infrastructure.logging import get_logger
from sync_crm.infrastructure.retry import retry_with_backoff

logger = get_logger(__name__)


from enum import Enum as PyEnum


class AlertLevel(str, PyEnum):
    """告警级别"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertChannel(ABC):
    """告警渠道抽象基类"""

    @abstractmethod
    def send(self, title: str, content: str, level: str = AlertLevel.INFO) -> bool:
        """
        发送告警

        Args:
            title: 告警标题
            content: 告警内容
            level: 告警级别

        Returns:
            是否发送成功
        """
        pass


class DingTalkChannel(AlertChannel):
    """钉钉机器人告警渠道"""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    @retry_with_backoff(max_attempts=3, wait_min=1)
    def send(self, title: str, content: str, level: str = AlertLevel.INFO) -> bool:
        """发送钉钉消息"""
        if not self.webhook_url:
            logger.warning("钉钉Webhook未配置，跳过发送")
            return False

        level_emoji = {
            AlertLevel.INFO: "ℹ️",
            AlertLevel.WARNING: "⚠️",
            AlertLevel.ERROR: "❌",
            AlertLevel.CRITICAL: "🔥",
        }.get(level, "ℹ️")

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        message = {
            "msgtype": "markdown",
            "markdown": {
                "title": f"{level_emoji} {title}",
                "text": f"### {level_emoji} {title}\n\n"
                f"**时间**: {timestamp}\n\n"
                f"**级别**: {level.upper()}\n\n"
                f"**内容**: \n\n{content}",
            },
        }

        try:
            with httpx.Client(timeout=10) as client:
                response = client.post(
                    self.webhook_url,
                    json=message,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                result = response.json()

                if result.get("errcode") == 0:
                    logger.info(f"钉钉告警发送成功: {title}")
                    return True
                else:
                    logger.error(f"钉钉告警发送失败: {result}")
                    return False

        except Exception as e:
            logger.error(f"钉钉告警发送异常: {e}")
            return False


class WeChatWorkChannel(AlertChannel):
    """企业微信机器人告警渠道"""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    @retry_with_backoff(max_attempts=3, wait_min=1)
    def send(self, title: str, content: str, level: str = AlertLevel.INFO) -> bool:
        """发送企业微信消息"""
        if not self.webhook_url:
            logger.warning("企业微信Webhook未配置，跳过发送")
            return False

        level_emoji = {
            AlertLevel.INFO: "ℹ️",
            AlertLevel.WARNING: "⚠️",
            AlertLevel.ERROR: "❌",
            AlertLevel.CRITICAL: "🔥",
        }.get(level, "ℹ️")

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        markdown_content = (
            f"{level_emoji} **{title}**\n\n"
            f"> **时间**: {timestamp}\n"
            f"> **级别**: {level.upper()}\n\n"
            f"{content}"
        )

        message = {
            "msgtype": "markdown",
            "markdown": {"content": markdown_content},
        }

        try:
            with httpx.Client(timeout=10) as client:
                response = client.post(
                    self.webhook_url,
                    json=message,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                result = response.json()

                if result.get("errcode") == 0:
                    logger.info(f"企业微信告警发送成功: {title}")
                    return True
                else:
                    logger.error(f"企业微信告警发送失败: {result}")
                    return False

        except Exception as e:
            logger.error(f"企业微信告警发送异常: {e}")
            return False


class EmailChannel(AlertChannel):
    """邮件告警渠道"""

    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        username: str,
        password: str,
        recipients: List[str],
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.recipients = recipients

    @retry_with_backoff(max_attempts=3, wait_min=2)
    def send(self, title: str, content: str, level: str = AlertLevel.INFO) -> bool:
        """发送邮件告警"""
        if not all([self.smtp_host, self.username, self.password, self.recipients]):
            logger.warning("邮件配置不完整，跳过发送")
            return False

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: {self._get_level_color(level)};">{self._get_level_icon(level)} {title}</h2>
            <table style="border-collapse: collapse; margin: 20px 0;">
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">时间</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{timestamp}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">级别</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{level.upper()}</td>
                </tr>
            </table>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                <p style="white-space: pre-wrap;">{content}</p>
            </div>
        </body>
        </html>
        """

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[CRM同步告警] {title}"
            msg["From"] = self.username
            msg["To"] = ", ".join(self.recipients)

            msg.attach(MIMEText(html_content, "html", "utf-8"))

            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context) as server:
                server.login(self.username, self.password)
                server.sendmail(self.username, self.recipients, msg.as_string())

            logger.info(f"邮件告警发送成功: {title}")
            return True

        except Exception as e:
            logger.error(f"邮件告警发送异常: {e}")
            return False

    def _get_level_color(self, level: str) -> str:
        return {
            AlertLevel.INFO: "#2196F3",
            AlertLevel.WARNING: "#FF9800",
            AlertLevel.ERROR: "#F44336",
            AlertLevel.CRITICAL: "#9C27B0",
        }.get(level, "#2196F3")

    def _get_level_icon(self, level: str) -> str:
        return {
            AlertLevel.INFO: "ℹ️",
            AlertLevel.WARNING: "⚠️",
            AlertLevel.ERROR: "❌",
            AlertLevel.CRITICAL: "🔥",
        }.get(level, "ℹ️")


class AlertNotifier:
    """告警通知器"""

    _instance: Optional["AlertNotifier"] = None

    def __init__(self):
        self.channels: Dict[str, AlertChannel] = {}
        self._init_channels()

    @classmethod
    def get_instance(cls) -> "AlertNotifier":
        """获取单例实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _init_channels(self) -> None:
        """初始化告警渠道"""
        alert_config = settings.alert
        enabled_channels = alert_config.enabled_channels

        if "dingtalk" in enabled_channels and alert_config.dingtalk_webhook:
            self.channels["dingtalk"] = DingTalkChannel(alert_config.dingtalk_webhook)

        if "wechat" in enabled_channels and alert_config.wechat_webhook:
            self.channels["wechat"] = WeChatWorkChannel(alert_config.wechat_webhook)

        if (
            "email" in enabled_channels
            and alert_config.email_smtp_host
            and alert_config.email_username
            and alert_config.email_password
            and alert_config.email_recipients
        ):
            self.channels["email"] = EmailChannel(
                smtp_host=alert_config.email_smtp_host,
                smtp_port=alert_config.email_smtp_port,
                username=alert_config.email_username,
                password=alert_config.email_password,
                recipients=alert_config.email_recipients,
            )

        logger.info(f"已初始化告警渠道: {list(self.channels.keys())}")

    def send_alert(
        self,
        title: str,
        content: str,
        level: str = AlertLevel.INFO,
        channels: Optional[List[str]] = None,
    ) -> Dict[str, bool]:
        """
        发送告警到所有已启用的渠道

        Args:
            title: 告警标题
            content: 告警内容
            level: 告警级别
            channels: 指定发送渠道，None表示发送到所有已启用渠道

        Returns:
            各渠道发送结果
        """
        results = {}
        target_channels = channels if channels else list(self.channels.keys())

        for channel_name in target_channels:
            channel = self.channels.get(channel_name)
            if channel:
                try:
                    results[channel_name] = channel.send(title, content, level)
                except Exception as e:
                    logger.error(f"告警渠道[{channel_name}]发送失败: {e}")
                    results[channel_name] = False
            else:
                results[channel_name] = False

        return results

    def notify_sync_delay(
        self,
        entity_type: str,
        delay_seconds: int,
        threshold_seconds: int,
    ) -> Dict[str, bool]:
        """发送同步延迟告警"""
        title = f"同步延迟告警 - {entity_type}"
        content = (
            f"数据同步延迟超过阈值！\n\n"
            f"实体类型: {entity_type}\n"
            f"当前延迟: {delay_seconds} 秒\n"
            f"阈值: {threshold_seconds} 秒\n\n"
            f"请检查同步任务是否正常运行。"
        )
        return self.send_alert(title, content, AlertLevel.WARNING)

    def notify_sync_failure(
        self,
        entity_type: str,
        task_id: str,
        error_type: str,
        error_detail: str,
    ) -> Dict[str, bool]:
        """发送同步失败告警"""
        title = f"同步任务失败 - {entity_type}"
        content = (
            f"同步任务执行失败！\n\n"
            f"实体类型: {entity_type}\n"
            f"任务ID: {task_id}\n"
            f"错误类型: {error_type}\n"
            f"错误详情: {error_detail}\n\n"
            f"请及时处理。"
        )
        return self.send_alert(title, content, AlertLevel.ERROR)

    def notify_sync_full_complete(
        self,
        entity_type: str,
        record_count: int,
        success_count: int,
        failed_count: int,
        duration_ms: int,
    ) -> Dict[str, bool]:
        """发送全量同步完成通知"""
        title = f"全量同步完成 - {entity_type}"
        content = (
            f"全量同步任务已完成！\n\n"
            f"实体类型: {entity_type}\n"
            f"总记录数: {record_count}\n"
            f"成功: {success_count}\n"
            f"失败: {failed_count}\n"
            f"耗时: {duration_ms / 1000:.2f} 秒\n\n"
            f"请检查同步结果。"
        )
        level = AlertLevel.INFO if failed_count == 0 else AlertLevel.WARNING
        return self.send_alert(title, content, level)

    def notify_consistency_issue(
        self,
        entity_type: str,
        inconsistent_count: int,
        samples: List[Dict[str, Any]],
    ) -> Dict[str, bool]:
        """发送数据一致性问题告警"""
        title = f"数据一致性告警 - {entity_type}"
        sample_text = "\n".join(
            [f"- local_id={s.get('local_id')}, remote_id={s.get('remote_id')}, "
             f"diff_fields={s.get('diff_fields')}" for s in samples[:10]]
        )
        content = (
            f"数据一致性检查发现不一致记录！\n\n"
            f"实体类型: {entity_type}\n"
            f"不一致记录数: {inconsistent_count}\n\n"
            f"问题样本（最多10条）:\n"
            f"{sample_text}\n\n"
            f"请运营人员核对并处理。"
        )
        return self.send_alert(title, content, AlertLevel.WARNING)

    def notify_system_error(
        self,
        component: str,
        error: str,
    ) -> Dict[str, bool]:
        """发送系统错误告警"""
        title = f"系统错误告警 - {component}"
        content = (
            f"系统组件发生错误！\n\n"
            f"组件: {component}\n"
            f"错误: {error}\n\n"
            f"请技术人员立即处理。"
        )
        return self.send_alert(title, content, AlertLevel.CRITICAL)


def get_alert_notifier() -> AlertNotifier:
    """获取告警通知器实例"""
    return AlertNotifier.get_instance()
