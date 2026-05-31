"""
ID生成器
生成任务ID、追踪ID等
"""
import uuid
import time
import hashlib
from typing import Optional, Dict, Any


def generate_task_id(prefix: str = "task") -> str:
    """
    生成任务ID

    Args:
        prefix: 前缀

    Returns:
        任务ID，格式: {prefix}_{timestamp}_{uuid8}
    """
    timestamp = int(time.time())
    uuid_str = uuid.uuid4().hex[:8]
    return f"{prefix}-{timestamp}-{uuid_str}"


def generate_trace_id() -> str:
    """
    生成追踪ID

    Returns:
        追踪ID（UUID4格式）
    """
    return str(uuid.uuid4())


def generate_record_hash(record: Dict[str, Any], fields: Optional[list] = None) -> str:
    """
    生成记录的哈希值，用于去重比较

    Args:
        record: 记录字典
        fields: 参与哈希计算的字段列表，不传则使用所有字段

    Returns:
        SHA256哈希字符串
    """
    if fields:
        data = {k: record.get(k) for k in fields if k in record}
    else:
        data = record

    data_str = str(sorted(data.items())).encode("utf-8")
    return hashlib.sha256(data_str).hexdigest()
