"""
数据转换工具
处理日期格式、手机号格式、金额单位等转换
"""
import re
from datetime import datetime, timezone
from typing import Optional, Any
from dateutil import parser as date_parser
import pytz

from sync_crm.config import settings


def convert_date_format(
    date_str: Optional[str],
    input_format: Optional[str] = None,
    output_format: str = "%Y-%m-%d",
) -> Optional[str]:
    """
    转换日期格式

    Args:
        date_str: 日期字符串
        input_format: 输入格式，不传则自动解析
        output_format: 输出格式

    Returns:
        转换后的日期字符串，失败返回None
    """
    if not date_str:
        return None

    try:
        if input_format:
            dt = datetime.strptime(date_str, input_format)
        else:
            dt = date_parser.parse(date_str)
        return dt.strftime(output_format)
    except (ValueError, TypeError):
        return None


def normalize_phone(phone: Optional[str], add_prefix: bool = False, prefix: str = "86") -> Optional[str]:
    """
    标准化手机号格式

    Args:
        phone: 手机号字符串
        add_prefix: 是否添加国际区号前缀
        prefix: 国际区号

    Returns:
        标准化后的手机号
    """
    if not phone:
        return None

    cleaned = re.sub(r"\D", "", phone)

    if cleaned.startswith(prefix):
        cleaned = cleaned[len(prefix):]

    if len(cleaned) == 11 and cleaned.startswith("1"):
        if add_prefix:
            return f"+{prefix}{cleaned}"
        return cleaned

    return phone


def convert_currency(
    amount: Optional[float],
    from_unit: str = "yuan",
    to_unit: str = "wan",
) -> Optional[float]:
    """
    金额单位转换

    Args:
        amount: 金额数值
        from_unit: 源单位: yuan/wan
        to_unit: 目标单位: yuan/wan

    Returns:
        转换后的金额
    """
    if amount is None:
        return None

    if from_unit == to_unit:
        return amount

    if from_unit == "yuan" and to_unit == "wan":
        return amount / 10000.0

    if from_unit == "wan" and to_unit == "yuan":
        return amount * 10000.0

    return amount


def parse_datetime_utc(dt_str: Optional[str]) -> Optional[datetime]:
    """
    解析日期时间字符串为UTC datetime

    Args:
        dt_str: 日期时间字符串

    Returns:
        UTC datetime对象，失败返回None
    """
    if not dt_str:
        return None

    try:
        dt = date_parser.parse(dt_str)
        if dt.tzinfo is None:
            tz = pytz.timezone(settings.sync.timezone)
            dt = tz.localize(dt)
        return dt.astimezone(pytz.UTC)
    except (ValueError, TypeError):
        return None


def format_datetime_utc(dt: Optional[datetime], output_format: str = "%Y-%m-%d %H:%M:%S") -> Optional[str]:
    """
    格式化UTC datetime为字符串

    Args:
        dt: datetime对象
        output_format: 输出格式

    Returns:
        格式化后的字符串
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        dt = pytz.UTC.localize(dt)
    else:
        dt = dt.astimezone(pytz.UTC)

    return dt.strftime(output_format)


def safe_cast(value: Any, target_type: type, default: Any = None) -> Any:
    """
    安全类型转换

    Args:
        value: 待转换的值
        target_type: 目标类型
        default: 转换失败时的默认值

    Returns:
        转换后的值
    """
    try:
        return target_type(value)
    except (ValueError, TypeError):
        return default
