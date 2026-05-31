"""
同步来源标记工具
用于防止数据循环同步
"""
from enum import Enum
from typing import Dict, Any, Optional


class SyncOrigin(str, Enum):
    """数据来源枚举"""

    CRM = "from_crm"
    MARKETING = "from_marketing"
    SYNC_SERVICE = "from_sync_service"
    UNKNOWN = "unknown"

    @classmethod
    def from_string(cls, value: Optional[str]) -> "SyncOrigin":
        """从字符串转换为枚举"""
        if not value:
            return cls.UNKNOWN
        try:
            return cls(value.lower())
        except ValueError:
            return cls.UNKNOWN


def mark_sync_source(
    data: Dict[str, Any],
    origin: SyncOrigin,
    source_field: str = "sync_source",
    origin_field: str = "origin",
) -> Dict[str, Any]:
    """
    标记数据同步来源

    Args:
        data: 数据字典
        origin: 来源系统
        source_field: 同步来源字段名
        origin_field: 原始来源字段名

    Returns:
        标记后的数据字典
    """
    marked_data = data.copy()

    if origin_field not in marked_data:
        marked_data[origin_field] = origin.value
    marked_data[source_field] = origin.value

    return marked_data


def check_sync_loop(
    data: Dict[str, Any],
    target_origin: SyncOrigin,
    source_field: str = "sync_source",
    origin_field: str = "origin",
) -> bool:
    """
    检查是否存在循环同步风险

    Args:
        data: 数据字典
        target_origin: 目标系统来源
        source_field: 同步来源字段名
        origin_field: 原始来源字段名

    Returns:
        True表示存在循环，应该跳过；False表示可以同步
    """
    current_source = SyncOrigin.from_string(data.get(source_field))
    original_origin = SyncOrigin.from_string(data.get(origin_field))

    if original_origin == target_origin:
        return True

    if current_source == target_origin:
        return True

    return False


def get_sync_origin(data: Dict[str, Any], origin_field: str = "origin") -> SyncOrigin:
    """获取数据的原始来源"""
    return SyncOrigin.from_string(data.get(origin_field))
