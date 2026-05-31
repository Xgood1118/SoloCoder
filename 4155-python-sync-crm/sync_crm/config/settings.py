"""
CRM同步服务配置管理
使用 pydantic_settings 进行配置加载和验证
"""
import os
from typing import Dict, List, Optional
from functools import lru_cache

from pydantic import Field, field_validator, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """数据库配置"""

    model_config = SettingsConfigDict(env_prefix="DB_", extra="ignore")

    host: str = Field(default="localhost", description="数据库主机地址")
    port: int = Field(default=3306, ge=1, le=65535, description="数据库端口")
    user: str = Field(default="root", description="数据库用户名")
    password: str = Field(default="", description="数据库密码")
    name: str = Field(default="crm_sync", description="数据库名称")
    charset: str = Field(default="utf8mb4", description="字符集")
    pool_size: int = Field(default=10, ge=1, description="连接池大小")
    max_overflow: int = Field(default=20, ge=0, description="连接池最大溢出数")
    pool_recycle: int = Field(default=3600, ge=60, description="连接回收时间(秒)")
    echo: bool = Field(default=False, description="是否输出SQL日志")

    @property
    def url(self) -> str:
        """构造数据库连接URL"""
        return (
            f"mysql+pymysql://{self.user}:{self.password}@{self.host}:{self.port}"
            f"/{self.name}?charset={self.charset}"
        )


class RedisSettings(BaseSettings):
    """Redis配置"""

    model_config = SettingsConfigDict(env_prefix="REDIS_", extra="ignore")

    host: str = Field(default="localhost", description="Redis主机地址")
    port: int = Field(default=6379, ge=1, le=65535, description="Redis端口")
    password: str = Field(default="", description="Redis密码")
    db: int = Field(default=0, ge=0, le=15, description="Redis数据库编号")
    max_connections: int = Field(default=50, ge=1, description="最大连接数")
    socket_timeout: int = Field(default=5, ge=1, description="超时时间(秒)")
    socket_connect_timeout: int = Field(default=5, ge=1, description="连接超时时间(秒)")

    @property
    def url(self) -> str:
        """构造Redis连接URL"""
        if self.password:
            return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
        return f"redis://{self.host}:{self.port}/{self.db}"


class CRMSettings(BaseSettings):
    """CRM系统配置"""

    model_config = SettingsConfigDict(env_prefix="CRM_", extra="ignore")

    base_url: str = Field(default="http://localhost:8080/api", description="CRM API地址")
    api_key: str = Field(default="", description="CRM API密钥")
    timeout: int = Field(default=30, ge=1, description="请求超时时间(秒)")
    retry_max_attempts: int = Field(default=5, ge=1, le=10, description="最大重试次数")
    health_check_path: str = Field(default="/health", description="健康检查路径")


class MarketingSettings(BaseSettings):
    """营销自动化平台配置"""

    model_config = SettingsConfigDict(env_prefix="MARKETING_", extra="ignore")

    base_url: str = Field(default="http://localhost:9090/api", description="营销平台API地址")
    api_key: str = Field(default="", description="营销平台API密钥")
    timeout: int = Field(default=30, ge=1, description="请求超时时间(秒)")
    retry_max_attempts: int = Field(default=5, ge=1, le=10, description="最大重试次数")
    health_check_path: str = Field(default="/health", description="健康检查路径")
    sync_source_field: str = Field(default="sync_source", description="同步来源字段名")
    origin_field: str = Field(default="origin", description="数据来源字段名")


class SyncSettings(BaseSettings):
    """同步配置"""

    model_config = SettingsConfigDict(env_prefix="SYNC_", extra="ignore")

    sync_delay_threshold: int = Field(default=300, ge=60, description="同步延迟阈值(秒)")
    batch_size: int = Field(default=100, ge=1, le=1000, description="每批同步条数")
    lock_timeout: int = Field(default=3600, ge=60, description="分布式锁超时时间(秒)")
    dedup_window_seconds: int = Field(default=60, ge=1, description="去重时间窗口(秒)")
    default_owner_assignment: str = Field(
        default="by_region",
        description="默认负责人分配策略: by_region/by_industry/random",
    )
    timezone: str = Field(default="Asia/Shanghai", description="默认时区")
    utc_storage: bool = Field(default=True, description="是否用UTC存储时间")

    @field_validator("default_owner_assignment")
    @classmethod
    def validate_owner_assignment(cls, v: str) -> str:
        allowed = ["by_region", "by_industry", "random"]
        if v not in allowed:
            raise ValueError(f"负责人分配策略必须是以下之一: {allowed}")
        return v


class ScheduleSettings(BaseSettings):
    """定时任务配置"""

    model_config = SettingsConfigDict(env_prefix="SCHEDULE_", extra="ignore")

    customer_cron: str = Field(default="*/5 * * * *", description="客户数据同步cron表达式")
    contact_cron: str = Field(default="*/5 * * * *", description="联系人同步cron表达式")
    lead_cron: str = Field(default="*/2 * * * *", description="线索同步cron表达式")
    order_cron: str = Field(default="*/10 * * * *", description="订单同步cron表达式")
    consistency_check_cron: str = Field(
        default="0 2 * * *", description="数据一致性检查cron表达式"
    )
    monitor_cron: str = Field(default="*/1 * * * *", description="监控检查cron表达式")


class AlertSettings(BaseSettings):
    """告警配置"""

    model_config = SettingsConfigDict(env_prefix="ALERT_", extra="ignore")

    dingtalk_webhook: Optional[str] = Field(default=None, description="钉钉机器人Webhook")
    wechat_webhook: Optional[str] = Field(default=None, description="企业微信机器人Webhook")
    email_smtp_host: Optional[str] = Field(default=None, description="邮件SMTP服务器")
    email_smtp_port: int = Field(default=465, description="邮件SMTP端口")
    email_username: Optional[str] = Field(default=None, description="邮件用户名")
    email_password: Optional[str] = Field(default=None, description="邮件密码")
    email_recipients: List[str] = Field(default_factory=list, description="告警邮件接收人")
    enabled_channels: List[str] = Field(
        default_factory=lambda: ["dingtalk"],
        description="启用的告警渠道: dingtalk/wechat/email",
    )

    @field_validator("enabled_channels")
    @classmethod
    def validate_channels(cls, v: List[str]) -> List[str]:
        allowed = ["dingtalk", "wechat", "email"]
        for channel in v:
            if channel not in allowed:
                raise ValueError(f"告警渠道必须是以下之一: {allowed}")
        return v


class LogSettings(BaseSettings):
    """日志配置"""

    model_config = SettingsConfigDict(env_prefix="LOG_", extra="ignore")

    level: str = Field(default="INFO", description="日志级别")
    format: str = Field(
        default="json",
        description="日志格式: json/text",
    )
    file_path: Optional[str] = Field(default=None, description="日志文件路径")
    rotation: str = Field(default="1 day", description="日志轮转周期")
    retention: str = Field(default="30 days", description="日志保留时间")
    enable_console: bool = Field(default=True, description="是否输出到控制台")

    @field_validator("level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        upper_v = v.upper()
        if upper_v not in allowed:
            raise ValueError(f"日志级别必须是以下之一: {allowed}")
        return upper_v

    @field_validator("format")
    @classmethod
    def validate_log_format(cls, v: str) -> str:
        allowed = ["json", "text"]
        if v not in allowed:
            raise ValueError(f"日志格式必须是以下之一: {allowed}")
        return v


class AppSettings(BaseSettings):
    """应用主配置"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="crm-sync-service", description="应用名称")
    app_env: str = Field(default="development", description="运行环境: development/production/test")
    debug: bool = Field(default=False, description="调试模式")
    log_level: str = Field(default="INFO", description="日志级别")

    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    crm: CRMSettings = Field(default_factory=CRMSettings)
    marketing: MarketingSettings = Field(default_factory=MarketingSettings)
    sync: SyncSettings = Field(default_factory=SyncSettings)
    schedule: ScheduleSettings = Field(default_factory=ScheduleSettings)
    alert: AlertSettings = Field(default_factory=AlertSettings)
    log: LogSettings = Field(default_factory=LogSettings)

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        allowed = ["development", "production", "test"]
        if v not in allowed:
            raise ValueError(f"运行环境必须是以下之一: {allowed}")
        return v


@lru_cache()
def get_settings() -> AppSettings:
    """获取配置实例（带缓存）"""
    try:
        return AppSettings()
    except ValidationError as e:
        raise RuntimeError(f"配置验证失败: {e}") from e


settings = get_settings()

__all__ = [
    "AppSettings",
    "DatabaseSettings",
    "RedisSettings",
    "CRMSettings",
    "MarketingSettings",
    "SyncSettings",
    "ScheduleSettings",
    "AlertSettings",
    "LogSettings",
    "settings",
    "get_settings",
]
