"""
同步管道核心基类
Source -> Transformer -> Target -> Verifier
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum as PyEnum
from typing import Any, Dict, List, Optional, Generator, AsyncGenerator

from sync_crm.models.mapping import EntityType
from sync_crm.utils.id_generator import generate_trace_id


class RecordStatus(str, PyEnum):
    """记录处理状态"""

    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    CONFLICT = "conflict"


@dataclass
class PipelineContext:
    """管道执行上下文"""

    task_id: str
    entity_type: EntityType
    trace_id: str = field(default_factory=generate_trace_id)
    operation_type: str = "INCREMENTAL"
    sync_direction: str = "crm_to_marketing"
    start_time: datetime = field(default_factory=datetime.utcnow)
    batch_size: int = 100
    extra: Dict[str, Any] = field(default_factory=dict)
    records_processed: int = 0
    records_success: int = 0
    records_failed: int = 0
    records_skipped: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)

    def add_error(self, record_id: str, error_type: str, error_detail: str) -> None:
        """添加错误信息"""
        self.errors.append(
            {
                "record_id": record_id,
                "error_type": error_type,
                "error_detail": error_detail,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

    def get_summary(self) -> Dict[str, Any]:
        """获取执行摘要"""
        duration = (datetime.utcnow() - self.start_time).total_seconds() * 1000
        return {
            "task_id": self.task_id,
            "trace_id": self.trace_id,
            "entity_type": self.entity_type.value,
            "operation_type": self.operation_type,
            "duration_ms": int(duration),
            "records_processed": self.records_processed,
            "records_success": self.records_success,
            "records_failed": self.records_failed,
            "records_skipped": self.records_skipped,
            "error_count": len(self.errors),
        }


@dataclass
class PipelineResult:
    """管道执行结果"""

    context: PipelineContext
    status: RecordStatus
    message: str = ""
    data: Dict[str, Any] = field(default_factory=dict)


class Source(ABC):
    """数据源抽象基类"""

    def __init__(self, entity_type: EntityType):
        self.entity_type = entity_type

    @abstractmethod
    def read(
        self,
        context: PipelineContext,
        last_sync_time: Optional[datetime] = None,
        batch_size: int = 100,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        读取源数据

        Args:
            context: 管道上下文
            last_sync_time: 上次同步时间，用于增量同步
            batch_size: 每批读取条数

        Yields:
            数据记录字典
        """
        pass

    @abstractmethod
    async def read_async(
        self,
        context: PipelineContext,
        last_sync_time: Optional[datetime] = None,
        batch_size: int = 100,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """异步读取源数据"""
        pass

    @abstractmethod
    def get_count(self, last_sync_time: Optional[datetime] = None) -> int:
        """获取待同步数据总数"""
        pass

    def health_check(self) -> bool:
        """健康检查"""
        return True


class Transformer(ABC):
    """数据转换器抽象基类"""

    def __init__(self, entity_type: EntityType):
        self.entity_type = entity_type

    @abstractmethod
    def transform(
        self,
        record: Dict[str, Any],
        context: PipelineContext,
    ) -> Optional[Dict[str, Any]]:
        """
        转换单条数据

        Args:
            record: 源数据记录
            context: 管道上下文

        Returns:
            转换后的数据，返回None表示跳过该记录
        """
        pass

    def transform_batch(
        self,
        records: List[Dict[str, Any]],
        context: PipelineContext,
    ) -> List[Dict[str, Any]]:
        """
        批量转换数据

        Args:
            records: 源数据记录列表
            context: 管道上下文

        Returns:
            转换后的数据列表
        """
        result = []
        for record in records:
            transformed = self.transform(record, context)
            if transformed is not None:
                result.append(transformed)
            else:
                context.records_skipped += 1
        return result

    async def transform_async(
        self,
        record: Dict[str, Any],
        context: PipelineContext,
    ) -> Optional[Dict[str, Any]]:
        """异步转换数据"""
        return self.transform(record, context)


class Target(ABC):
    """目标系统抽象基类"""

    def __init__(self, entity_type: EntityType):
        self.entity_type = entity_type

    @abstractmethod
    def write(
        self,
        record: Dict[str, Any],
        context: PipelineContext,
    ) -> Optional[Dict[str, Any]]:
        """
        写入单条数据到目标系统

        Args:
            record: 待写入的数据记录
            context: 管道上下文

        Returns:
            写入后的结果（包含目标系统返回的ID等）
        """
        pass

    def write_batch(
        self,
        records: List[Dict[str, Any]],
        context: PipelineContext,
    ) -> List[Optional[Dict[str, Any]]]:
        """
        批量写入数据到目标系统

        Args:
            records: 待写入的数据记录列表
            context: 管道上下文

        Returns:
            写入结果列表
        """
        results = []
        for record in records:
            try:
                result = self.write(record, context)
                results.append(result)
                context.records_success += 1
            except Exception as e:
                context.records_failed += 1
                context.add_error(
                    record_id=str(record.get("id", "unknown")),
                    error_type=type(e).__name__,
                    error_detail=str(e),
                )
                results.append(None)
        return results

    @abstractmethod
    async def write_async(
        self,
        record: Dict[str, Any],
        context: PipelineContext,
    ) -> Optional[Dict[str, Any]]:
        """异步写入数据"""
        pass

    def health_check(self) -> bool:
        """健康检查"""
        return True

    def update_mapping(self, local_id: str, remote_id: str) -> None:
        """更新映射关系（可选实现）"""
        pass


class Verifier(ABC):
    """数据校验器抽象基类"""

    def __init__(self, entity_type: EntityType):
        self.entity_type = entity_type

    @abstractmethod
    def verify(
        self,
        source_record: Dict[str, Any],
        target_record: Dict[str, Any],
        context: PipelineContext,
    ) -> tuple[bool, Optional[str]]:
        """
        校验源数据和目标数据是否一致

        Args:
            source_record: 源系统数据
            target_record: 目标系统数据
            context: 管道上下文

        Returns:
            (是否一致, 不一致的详情)
        """
        pass

    def verify_batch(
        self,
        source_records: List[Dict[str, Any]],
        target_records: List[Dict[str, Any]],
        context: PipelineContext,
    ) -> List[tuple[bool, Optional[str]]]:
        """
        批量校验数据

        Args:
            source_records: 源系统数据列表
            target_records: 目标系统数据列表
            context: 管道上下文

        Returns:
            校验结果列表
        """
        results = []
        for source, target in zip(source_records, target_records):
            if target is None:
                results.append((False, "目标数据为空"))
            else:
                results.append(self.verify(source, target, context))
        return results

    def find_discrepancies(
        self,
        context: PipelineContext,
        batch_size: int = 100,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        全量查找不一致的数据

        Args:
            context: 管道上下文
            batch_size: 每批处理条数

        Yields:
            不一致的数据详情
        """
        pass


class Pipeline:
    """同步管道执行器"""

    def __init__(
        self,
        source: Source,
        transformer: Transformer,
        target: Target,
        verifier: Optional[Verifier] = None,
    ):
        self.source = source
        self.transformer = transformer
        self.target = target
        self.verifier = verifier

    def execute(
        self,
        context: PipelineContext,
        last_sync_time: Optional[datetime] = None,
    ) -> PipelineResult:
        """
        执行同步管道

        Args:
            context: 管道上下文
            last_sync_time: 上次同步时间

        Returns:
            执行结果
        """
        try:
            if not self.source.health_check():
                return PipelineResult(
                    context=context,
                    status=RecordStatus.FAILED,
                    message="数据源健康检查失败",
                )

            if not self.target.health_check():
                return PipelineResult(
                    context=context,
                    status=RecordStatus.FAILED,
                    message="目标系统健康检查失败",
                )

            for record in self.source.read(context, last_sync_time, context.batch_size):
                context.records_processed += 1

                transformed = self.transformer.transform(record, context)
                if transformed is None:
                    context.records_skipped += 1
                    continue

                result = self.target.write(transformed, context)
                if result is not None:
                    context.records_success += 1
                    self.target.update_mapping(
                        local_id=str(record.get("id", "")),
                        remote_id=str(result.get("id", "")),
                    )
                else:
                    context.records_failed += 1

            return PipelineResult(
                context=context,
                status=RecordStatus.SUCCESS,
                message="同步完成",
                data=context.get_summary(),
            )

        except Exception as e:
            context.add_error(
                record_id="pipeline",
                error_type=type(e).__name__,
                error_detail=str(e),
            )
            return PipelineResult(
                context=context,
                status=RecordStatus.FAILED,
                message=f"同步异常: {e}",
                data=context.get_summary(),
            )

    async def execute_async(
        self,
        context: PipelineContext,
        last_sync_time: Optional[datetime] = None,
    ) -> PipelineResult:
        """异步执行同步管道"""
        try:
            async for record in self.source.read_async(context, last_sync_time, context.batch_size):
                context.records_processed += 1

                transformed = await self.transformer.transform_async(record, context)
                if transformed is None:
                    context.records_skipped += 1
                    continue

                result = await self.target.write_async(transformed, context)
                if result is not None:
                    context.records_success += 1
                else:
                    context.records_failed += 1

            return PipelineResult(
                context=context,
                status=RecordStatus.SUCCESS,
                message="同步完成",
                data=context.get_summary(),
            )

        except Exception as e:
            context.add_error(
                record_id="pipeline",
                error_type=type(e).__name__,
                error_detail=str(e),
            )
            return PipelineResult(
                context=context,
                status=RecordStatus.FAILED,
                message=f"同步异常: {e}",
                data=context.get_summary(),
            )
