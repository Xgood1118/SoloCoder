"""
同步服务基类
"""
from datetime import datetime, timedelta
from enum import Enum as PyEnum
from typing import Any, Dict, Optional, List, Tuple

from sqlalchemy.orm import Session

from sync_crm.config import settings
from sync_crm.models.mapping import EntityType, SyncMapping, MappingStatus
from sync_crm.models.sync_log import SyncLog, OperationType, TaskStatus
from sync_crm.pipeline.base import (
    Pipeline,
    PipelineContext,
    PipelineResult,
    RecordStatus,
    Transformer,
    Source,
    Target,
)
from sync_crm.pipeline.transformer import FieldMappingTransformer, DataCleaningTransformer
from sync_crm.infrastructure.adapters import CRMAdapter, MarketingAdapter
from sync_crm.infrastructure.distributed_lock import distributed_lock
from sync_crm.infrastructure.logging import get_logger
from sync_crm.utils.id_generator import generate_task_id

logger = get_logger(__name__)


class SyncDirection(str, PyEnum):
    """同步方向"""

    CRM_TO_MARKETING = "crm_to_marketing"
    MARKETING_TO_CRM = "marketing_to_crm"
    BIDIRECTIONAL = "bidirectional"


class SyncService:
    """同步服务基类"""

    entity_type: EntityType
    direction: SyncDirection = SyncDirection.CRM_TO_MARKETING

    def __init__(self, db_session: Session):
        self.db_session = db_session
        self.crm_adapter = CRMAdapter(db_session)
        self.marketing_adapter = MarketingAdapter(db_session)

    def _get_last_sync_time(self) -> Optional[datetime]:
        """获取上次同步时间"""
        last_log = (
            self.db_session.query(SyncLog)
            .filter(
                SyncLog.entity_type == self.entity_type,
                SyncLog.status == TaskStatus.SUCCESS,
            )
            .order_by(SyncLog.finished_at.desc())
            .first()
        )
        if last_log and last_log.finished_at:
            return last_log.finished_at
        return None

    def _create_sync_log(
        self,
        operation_type: OperationType,
        sync_source: str = "scheduler",
        operator: Optional[str] = None,
    ) -> SyncLog:
        """创建同步日志记录"""
        log = SyncLog(
            task_id=generate_task_id("sync"),
            entity_type=self.entity_type,
            operation_type=operation_type,
            sync_source=sync_source,
            operator=operator,
            status=TaskStatus.PENDING,
        )
        self.db_session.add(log)
        self.db_session.commit()
        self.db_session.refresh(log)
        return log

    def _update_sync_log(
        self,
        log: SyncLog,
        result: PipelineResult,
    ) -> None:
        """更新同步日志记录"""
        context = result.context
        log.status = (
            TaskStatus.SUCCESS
            if result.status == RecordStatus.SUCCESS
            else TaskStatus.FAILED
        )
        if result.status == RecordStatus.CONFLICT:
            log.status = TaskStatus.PARTIAL

        log.record_count = context.records_processed
        log.success_count = context.records_success
        log.failed_count = context.records_failed
        log.skipped_count = context.records_skipped
        log.duration_ms = context.get_summary()["duration_ms"]
        log.error_detail = result.message if result.status != RecordStatus.SUCCESS else None
        log.failed_records = context.errors if context.errors else None
        log.finished_at = datetime.utcnow()

        self.db_session.commit()

    def _get_pipeline(self, direction: SyncDirection) -> Pipeline:
        """获取同步管道"""
        if direction == SyncDirection.CRM_TO_MARKETING:
            source = self.crm_adapter.get_source(self.entity_type)
            target = self.marketing_adapter.get_target(self.entity_type)
            mapping_direction = "crm_to_marketing"
        else:
            source = self.marketing_adapter.get_source(self.entity_type)
            target = self.crm_adapter.get_target(self.entity_type)
            mapping_direction = "marketing_to_crm"

        field_transformer = FieldMappingTransformer(
            self.entity_type, mapping_direction, self.db_session
        )
        cleaning_transformer = DataCleaningTransformer(self.entity_type)

        class CombinedTransformer(Transformer):
            def __init__(self, entity_type, field_tf, cleaning_tf):
                super().__init__(entity_type)
                self.field_tf = field_tf
                self.cleaning_tf = cleaning_tf

            def transform(self, record, context):
                cleaned = self.cleaning_tf.transform(record, context)
                if cleaned is None:
                    return None
                return self.field_tf.transform(cleaned, context)

            async def transform_async(self, record, context):
                return self.transform(record, context)

        transformer = CombinedTransformer(
            self.entity_type, field_transformer, cleaning_transformer
        )

        return Pipeline(source=source, transformer=transformer, target=target)

    def _execute_sync(
        self,
        direction: SyncDirection,
        operation_type: OperationType,
        sync_source: str = "scheduler",
        operator: Optional[str] = None,
        is_full: bool = False,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        执行同步

        Args:
            direction: 同步方向
            operation_type: 操作类型
            sync_source: 触发来源
            operator: 操作人
            is_full: 是否全量同步
            start_time: 同步起始时间
            end_time: 同步结束时间

        Returns:
            同步结果摘要
        """
        lock_key = f"sync:{self.entity_type.value}:{direction.value}"

        with distributed_lock(lock_key, timeout=settings.sync.lock_timeout):
            log = self._create_sync_log(operation_type, sync_source, operator)

            try:
                log.mark_started()
                self.db_session.commit()

                context = PipelineContext(
                    task_id=log.task_id,
                    entity_type=self.entity_type,
                    operation_type=operation_type.value,
                    sync_direction=direction.value,
                    batch_size=settings.sync.batch_size,
                    extra={
                        "is_full": is_full,
                        "start_time": start_time.isoformat() if start_time else None,
                        "end_time": end_time.isoformat() if end_time else None,
                    },
                )

                last_sync_time = None if is_full else self._get_last_sync_time()
                if start_time:
                    last_sync_time = start_time

                pipeline = self._get_pipeline(direction)
                result = pipeline.execute(context, last_sync_time)

                self._update_sync_log(log, result)

                summary = result.data
                summary["task_id"] = log.task_id
                summary["status"] = log.status.value

                logger.info(
                    f"同步完成: entity={self.entity_type.value}, "
                    f"direction={direction.value}, status={log.status.value}, "
                    f"success={context.records_success}, failed={context.records_failed}"
                )

                return summary

            except Exception as e:
                logger.error(
                    f"同步异常: entity={self.entity_type.value}, "
                    f"direction={direction.value}, error={e}",
                    exc_info=True,
                )
                log.mark_failed(
                    error_type=type(e).__name__,
                    error_detail=str(e),
                )
                self.db_session.commit()
                raise

    def sync_incremental(
        self,
        direction: Optional[SyncDirection] = None,
        sync_source: str = "scheduler",
    ) -> Dict[str, Any]:
        """增量同步"""
        direction = direction or self.direction
        return self._execute_sync(
            direction=direction,
            operation_type=OperationType.INCREMENTAL,
            sync_source=sync_source,
            is_full=False,
        )

    def sync_full(
        self,
        direction: Optional[SyncDirection] = None,
        sync_source: str = "manual",
        operator: Optional[str] = None,
    ) -> Dict[str, Any]:
        """全量同步"""
        direction = direction or self.direction
        return self._execute_sync(
            direction=direction,
            operation_type=OperationType.FULL_SYNC,
            sync_source=sync_source,
            operator=operator,
            is_full=True,
        )

    def sync_manual(
        self,
        record_ids: Optional[List[str]] = None,
        direction: Optional[SyncDirection] = None,
        operator: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """手工触发同步"""
        direction = direction or self.direction
        result = self._execute_sync(
            direction=direction,
            operation_type=OperationType.MANUAL,
            sync_source="manual",
            operator=operator,
            is_full=False,
            start_time=start_time,
            end_time=end_time,
        )
        if record_ids:
            result["specified_ids"] = record_ids
        return result

    def get_sync_status(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """获取同步状态"""
        if task_id:
            log = (
                self.db_session.query(SyncLog)
                .filter(SyncLog.task_id == task_id)
                .first()
            )
            if log:
                return log.to_dict()
            return {"error": "任务不存在"}

        latest_logs = (
            self.db_session.query(SyncLog)
            .filter(SyncLog.entity_type == self.entity_type)
            .order_by(SyncLog.created_at.desc())
            .limit(10)
            .all()
        )

        last_success = (
            self.db_session.query(SyncLog)
            .filter(
                SyncLog.entity_type == self.entity_type,
                SyncLog.status == TaskStatus.SUCCESS,
            )
            .order_by(SyncLog.finished_at.desc())
            .first()
        )

        return {
            "entity_type": self.entity_type.value,
            "last_sync_time": last_success.finished_at if last_success else None,
            "latest_tasks": [log.to_dict() for log in latest_logs],
        }

    def check_delay(self) -> Tuple[bool, int]:
        """
        检查同步延迟

        Returns:
            (是否超过阈值, 延迟秒数)
        """
        last_sync_time = self._get_last_sync_time()
        if not last_sync_time:
            return False, 0

        delay = (datetime.utcnow() - last_sync_time).total_seconds()
        threshold = settings.sync.sync_delay_threshold
        is_over = delay > threshold

        if is_over:
            logger.warning(
                f"同步延迟超过阈值: entity={self.entity_type.value}, "
                f"delay={delay}s, threshold={threshold}s"
            )

        return is_over, int(delay)
