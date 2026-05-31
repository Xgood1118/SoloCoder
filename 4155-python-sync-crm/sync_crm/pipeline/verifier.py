"""
数据校验器实现
"""
from typing import Any, Dict, Optional, List, Generator

from sync_crm.models.mapping import EntityType
from sync_crm.pipeline.base import Verifier, PipelineContext, RecordStatus
from sync_crm.utils.sync_source import check_sync_loop, SyncOrigin
from sync_crm.infrastructure.logging import get_logger

logger = get_logger(__name__)


class DataConsistencyVerifier(Verifier):
    """
    数据一致性校验器

    比较源系统和目标系统的数据是否一致。
    """

    def __init__(
        self,
        entity_type: EntityType,
        compare_fields: Optional[List[str]] = None,
        ignore_fields: Optional[List[str]] = None,
    ):
        super().__init__(entity_type)
        self.compare_fields = compare_fields
        self.ignore_fields = ignore_fields or [
            "id",
            "created_at",
            "updated_at",
            "sync_source",
            "origin",
        ]

    def verify(
        self,
        source_record: Dict[str, Any],
        target_record: Dict[str, Any],
        context: PipelineContext,
    ) -> tuple[bool, Optional[str]]:
        """
        校验两条记录是否一致

        Args:
            source_record: 源系统数据
            target_record: 目标系统数据
            context: 管道上下文

        Returns:
            (是否一致, 不一致的详情)
        """
        if check_sync_loop(target_record, SyncOrigin.CRM):
            return True, None

        discrepancies = []

        if self.compare_fields:
            fields = self.compare_fields
        else:
            fields = set(source_record.keys()) | set(target_record.keys())
            fields = [f for f in fields if f not in self.ignore_fields]

        for field in fields:
            source_val = source_record.get(field)
            target_val = target_record.get(field)

            source_str = str(source_val).strip() if source_val is not None else ""
            target_str = str(target_val).strip() if target_val is not None else ""

            if source_str != target_str:
                discrepancies.append(
                    f"字段 {field}: 源='{source_val}' vs 目标='{target_val}'"
                )

        if discrepancies:
            return False, "; ".join(discrepancies)

        return True, None

    def find_discrepancies(
        self,
        context: PipelineContext,
        batch_size: int = 100,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        全量查找不一致的数据（需要子类实现具体的数据源读取逻辑）
        """
        raise NotImplementedError("子类需要实现具体的全量校验逻辑")


def calculate_consistency_score(
    total_records: int,
    consistent_records: int,
) -> float:
    """
    计算数据一致性得分

    Args:
        total_records: 总记录数
        consistent_records: 一致记录数

    Returns:
        一致性得分(0-100)
    """
    if total_records == 0:
        return 100.0
    return round(consistent_records / total_records * 100, 2)


def generate_consistency_report(
    entity_type: EntityType,
    total_count: int,
    consistent_count: int,
    discrepancies: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    生成一致性校验报告

    Args:
        entity_type: 实体类型
        total_count: 总记录数
        consistent_count: 一致记录数
        discrepancies: 不一致记录列表

    Returns:
        报告字典
    """
    score = calculate_consistency_score(total_count, consistent_count)
    inconsistent_count = total_count - consistent_count

    return {
        "entity_type": entity_type.value,
        "check_time": __import__("datetime").datetime.utcnow().isoformat(),
        "total_count": total_count,
        "consistent_count": consistent_count,
        "inconsistent_count": inconsistent_count,
        "consistency_score": score,
        "discrepancies": discrepancies[:100],
        "has_more": len(discrepancies) > 100,
        "summary": (
            f"数据一致性校验完成: 共{total_count}条, "
            f"一致{consistent_count}条, 不一致{inconsistent_count}条, "
            f"得分{score}分"
        ),
    }
