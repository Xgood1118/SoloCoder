from __future__ import annotations

import json
import os
from typing import Any, List, Dict


class EasyQueue:
    def __init__(self):
        self._items = []
    
    def put(self, item):
        self._items.append(item)
    
    def get(self):
        return self._items.pop(0) if self._items else None
    
    def empty(self) -> bool:
        return len(self._items) == 0


def safe_cast(value: Any, target_type, default: Any = None) -> Any:
    if value is None:
        return default
    try:
        return target_type(value)
    except (ValueError, TypeError):
        return default


def safe_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value
    try:
        return str(value)
    except Exception:
        return default


def safe_int(value: Any, default: int = 0) -> int:
    return safe_cast(value, int, default)


def safe_float(value: Any, default: float = 0.0) -> float:
    return safe_cast(value, float, default)


def clean_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, float) and int(value) == value:
        return int(value)
    return value


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, dict, set)):
        return len(value) == 0
    return False


def ensure_dir(file_path: str) -> None:
    dir_path = os.path.dirname(file_path)
    if dir_path:
        os.makedirs(dir_path, exist_ok=True)
