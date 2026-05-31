from functools import lru_cache
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    url: str = Field(..., alias="DATABASE_URL")
    pool_size: int = Field(20, alias="DATABASE_POOL_SIZE")
    max_overflow: int = Field(10, alias="DATABASE_MAX_OVERFLOW")
    echo: bool = Field(False, alias="DATABASE_ECHO")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class RedisSettings(BaseSettings):
    url: str = Field("redis://localhost:6379/0", alias="REDIS_URL")
    password: Optional[str] = Field(None, alias="REDIS_PASSWORD")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class CelerySettings(BaseSettings):
    broker_url: str = Field(..., alias="CELERY_BROKER_URL")
    result_backend: str = Field(..., alias="CELERY_RESULT_BACKEND")
    task_serializer: str = "json"
    result_serializer: str = "json"
    accept_content: list[str] = ["json"]
    timezone: str = Field("Asia/Shanghai", alias="TIMEZONE")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class CRMSettings(BaseSettings):
    api_base_url: str = Field(..., alias="CRM_API_BASE_URL")
    api_key: str = Field(..., alias="CRM_API_KEY")
    timeout: int = Field(30, alias="CRM_API_TIMEOUT")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class MarketingSettings(BaseSettings):
    api_base_url: str = Field(..., alias="MARKETING_API_BASE_URL")
    api_key: str = Field(..., alias="MARKETING_API_KEY")
    timeout: int = Field(30, alias="MARKETING_API_TIMEOUT")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class SyncSettings(BaseSettings):
    batch_size: int = Field(100, alias="SYNC_BATCH_SIZE")
    retry_max_attempts: int = Field(5, alias="SYNC_RETRY_MAX_ATTEMPTS")
    retry_initial_wait: int = Field(1, alias="SYNC_RETRY_INITIAL_WAIT")
    max_delay_minutes: int = Field(5, alias="SYNC_MAX_DELAY_MINUTES")

    customer_cron: str = Field("*/5 * * * *", alias="SYNC_CUSTOMER_CRON")
    contact_cron: str = Field("*/5 * * * *", alias="SYNC_CONTACT_CRON")
    lead_cron: str = Field("*/2 * * * *", alias="SYNC_LEAD_CRON")
    order_cron: str = Field("*/10 * * * *", alias="SYNC_ORDER_CRON")

    @field_validator("batch_size")
    @classmethod
    def validate_batch_size(cls, v: int) -> int:
        if v < 1 or v > 1000:
            raise ValueError("batch_size must be between 1 and 1000")
        return v

    @field_validator("retry_max_attempts")
    @classmethod
    def validate_retry_attempts(cls, v: int) -> int:
        if v < 1 or v > 10:
            raise ValueError("retry_max_attempts must be between 1 and 10")
        return v

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class AlertSettings(BaseSettings):
    webhook_url: Optional[str] = Field(None, alias="ALERT_WEBHOOK_URL")
    enabled: bool = Field(False, alias="ALERT_ENABLED")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class LogSettings(BaseSettings):
    level: str = Field("INFO", alias="LOG_LEVEL")
    file_path: str = Field("./logs/crm_sync.log", alias="LOG_FILE_PATH")
    rotation: str = "10 MB"
    retention: str = "7 days"

    @field_validator("level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"log_level must be one of {valid_levels}")
        return v.upper()

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class Settings(BaseSettings):
    app_name: str = Field("crm-sync-service", alias="APP_NAME")
    app_env: str = Field("development", alias="APP_ENV")
    debug: bool = Field(False, alias="DEBUG")
    timezone: str = Field("Asia/Shanghai", alias="TIMEZONE")

    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    celery: CelerySettings = Field(default_factory=CelerySettings)
    crm: CRMSettings = Field(default_factory=CRMSettings)
    marketing: MarketingSettings = Field(default_factory=MarketingSettings)
    sync: SyncSettings = Field(default_factory=SyncSettings)
    alert: AlertSettings = Field(default_factory=AlertSettings)
    log: LogSettings = Field(default_factory=LogSettings)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
