from __future__ import annotations

import re
from datetime import datetime, date
from typing import Optional, Union

DATE_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%Y/%m/%d %H:%M:%S",
    "%Y/%m/%d %H:%M",
    "%Y/%m/%d",
    "%Y年%m月%d日",
    "%Y年%m月%d日 %H:%M:%S",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%m-%d-%Y",
    "%m/%d/%Y",
    "%y-%m-%d",
    "%y/%m/%d",
    "%Y%m%d",
    "%Y%m%d%H%M%S",
]

TIMESTAMP_PATTERN = re.compile(r"^\d{10,13}$")


def parse_date(value: Union[str, int, float, None]) -> Optional[datetime]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, (int, float)):
        try:
            if value > 10**12:
                value = value / 1000
            if value < -1e10:
                return None
            return datetime.fromtimestamp(value)
        except (ValueError, OSError):
            return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        if TIMESTAMP_PATTERN.match(value):
            try:
                ts = int(value)
                if len(value) == 13:
                    ts = ts / 1000
                return datetime.fromtimestamp(ts)
            except (ValueError, OSError):
                pass
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        try:
            from dateutil.parser import parse
            return parse(value, fuzzy=True)
        except (ImportError, ValueError, OverflowError):
            pass
    return None


def format_date(value: Union[str, int, float, datetime, date, None], output_format: str = "%Y-%m-%d") -> Optional[str]:
    dt = parse_date(value)
    if dt is None:
        return None
    try:
        return dt.strftime(output_format)
    except ValueError:
        return None


def is_valid_date(value: Union[str, int, float, None]) -> bool:
    return parse_date(value) is not None


def get_date_range(
    start: Union[str, int, float, datetime, date, None],
    end: Union[str, int, float, datetime, date, None],
) -> tuple[Optional[datetime], Optional[datetime]]:
    return parse_date(start), parse_date(end)
