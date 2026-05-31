"""
工具函数测试
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal

from sync_crm.utils.sync_source import SyncOrigin, mark_sync_source, check_sync_loop, get_sync_origin
from sync_crm.utils.data_converter import (
    convert_date_format,
    normalize_phone,
    convert_currency,
    parse_datetime_utc,
    safe_cast,
)
from sync_crm.utils.id_generator import generate_task_id, generate_trace_id, generate_record_hash


@pytest.mark.unit
class TestSyncSourceUtils:
    """同步来源工具测试"""

    def test_sync_origin_values(self):
        """测试SyncOrigin枚举值"""
        assert SyncOrigin.CRM.value == "from_crm"
        assert SyncOrigin.MARKETING.value == "from_marketing"
        assert SyncOrigin.SYNC_SERVICE.value == "from_sync_service"

    def test_mark_sync_source(self):
        """测试标记同步来源"""
        data = {"name": "测试"}
        result = mark_sync_source(data, SyncOrigin.CRM)

        assert result["sync_source"] == "from_crm"
        assert result["origin"] == "from_crm"

    def test_check_sync_loop_from_crm(self):
        """测试检查循环同步 - CRM数据回传CRM"""
        data = {"sync_source": "from_crm", "origin": "from_crm"}
        assert check_sync_loop(data, SyncOrigin.CRM) is True

    def test_check_sync_loop_from_marketing(self):
        """测试检查循环同步 - 营销平台数据回传营销平台"""
        data = {"sync_source": "from_marketing", "origin": "from_marketing"}
        assert check_sync_loop(data, SyncOrigin.MARKETING) is True

    def test_check_sync_loop_no_loop(self):
        """测试检查循环同步 - 正常流转"""
        data = {"sync_source": "from_crm", "origin": "from_crm"}
        assert check_sync_loop(data, SyncOrigin.MARKETING) is False

    def test_get_sync_origin(self):
        """测试获取同步来源"""
        data = {"origin": "from_crm"}
        assert get_sync_origin(data) == SyncOrigin.CRM

        data2 = {"origin": "unknown"}
        assert get_sync_origin(data2) == SyncOrigin.UNKNOWN

        data3 = {}
        assert get_sync_origin(data3) == SyncOrigin.UNKNOWN


@pytest.mark.unit
class TestDataConverter:
    """数据转换工具测试"""

    def test_convert_date_format(self):
        """测试日期格式转换"""
        result = convert_date_format("2024-01-01", "%Y-%m-%d", "%Y/%m/%d")
        assert result == "2024/01/01"

    def test_convert_date_format_invalid(self):
        """测试无效日期格式转换"""
        result = convert_date_format("invalid", "%Y-%m-%d", "%Y/%m/%d")
        assert result is None

    def test_normalize_phone_with_prefix(self):
        """测试手机号标准化 - 带前缀"""
        assert normalize_phone("+8613800138000") == "13800138000"
        assert normalize_phone("8613800138000") == "13800138000"

    def test_normalize_phone_with_spaces(self):
        """测试手机号标准化 - 带空格"""
        assert normalize_phone("138 0013 8000") == "13800138000"
        assert normalize_phone("138-0013-8000") == "13800138000"

    def test_convert_currency_yuan_to_wan(self):
        """测试金额单位转换 - 元转万元"""
        assert convert_currency(50000, "yuan", "wan") == 5.0

    def test_convert_currency_wan_to_yuan(self):
        """测试金额单位转换 - 万元转元"""
        assert convert_currency(5, "wan", "yuan") == 50000.0

    def test_parse_datetime_utc(self):
        """测试UTC时间解析"""
        dt = parse_datetime_utc("2024-01-01T12:00:00Z")
        assert dt is not None
        assert dt.year == 2024

    def test_safe_cast_int(self):
        """测试安全类型转换 - 整数"""
        assert safe_cast("123", int) == 123
        assert safe_cast("abc", int, 0) == 0

    def test_safe_cast_float(self):
        """测试安全类型转换 - 浮点数"""
        assert safe_cast("123.45", float) == 123.45
        assert safe_cast("abc", float, 0.0) == 0.0

    def test_safe_cast_decimal(self):
        """测试安全类型转换 - Decimal"""
        result = safe_cast("123.45", Decimal)
        assert result == Decimal("123.45")


@pytest.mark.unit
class TestIdGenerator:
    """ID生成器测试"""

    def test_generate_task_id_prefix(self):
        """测试任务ID生成 - 前缀"""
        task_id = generate_task_id("sync")
        assert task_id.startswith("sync-")

    def test_generate_trace_id_format(self):
        """测试追踪ID生成 - 格式"""
        trace_id = generate_trace_id()
        assert len(trace_id) > 0

    def test_generate_record_hash_consistent(self):
        """测试记录哈希生成 - 一致性"""
        data = {"id": "123", "name": "test"}
        hash1 = generate_record_hash(data)
        hash2 = generate_record_hash(data)
        assert hash1 == hash2

    def test_generate_record_hash_different(self):
        """测试记录哈希生成 - 不同数据不同哈希"""
        data1 = {"id": "123", "name": "test1"}
        data2 = {"id": "123", "name": "test2"}
        assert generate_record_hash(data1) != generate_record_hash(data2)
