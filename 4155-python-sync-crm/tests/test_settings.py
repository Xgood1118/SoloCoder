"""
配置管理测试
"""
import pytest

from sync_crm.config import get_settings, settings


@pytest.mark.unit
class TestSettings:
    """配置测试"""

    def test_get_settings_cached(self):
        """测试配置缓存"""
        settings1 = get_settings()
        settings2 = get_settings()
        assert settings1 is settings2

    def test_database_url(self):
        """测试数据库URL构造"""
        db_settings = settings.database
        assert "mysql" in db_settings.url

    def test_redis_url(self):
        """测试Redis URL构造"""
        redis_settings = settings.redis
        assert "redis://" in redis_settings.url

    def test_sync_delay_threshold(self):
        """测试同步延迟阈值"""
        assert settings.sync.sync_delay_threshold >= 60

    def test_owner_assignment_validation(self):
        """测试负责人分配策略验证"""
        assert settings.sync.default_owner_assignment in ["by_region", "by_industry", "random"]

    def test_log_level_validation(self):
        """测试日志级别验证"""
        assert settings.log.level in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

    def test_alert_channels_validation(self):
        """测试告警渠道验证"""
        for channel in settings.alert.enabled_channels:
            assert channel in ["dingtalk", "wechat", "email"]

    def test_cron_expressions(self):
        """测试cron表达式格式"""
        schedule = settings.schedule
        assert schedule.customer_cron
        assert schedule.contact_cron
        assert schedule.lead_cron
        assert schedule.order_cron
