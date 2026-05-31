"""
同步日志表模型
记录每次同步任务的执行情况
"""
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Text,
    BigInteger,
    JSON,
    Index,
)
from sqlalchemy import Enum as SAEnum

from sync_crm.models.base import Base
from sync_crm.models.mapping import EntityType


class TaskStatus(str, PyEnum):
    """任务状态枚举"""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


class OperationType(str, PyEnum):
    """操作类型枚举"""

    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    UPSERT = "UPSERT"
    FULL_SYNC = "FULL_SYNC"
    INCREMENTAL = "INCREMENTAL"
    MANUAL = "MANUAL"


class SyncLog(Base):
    """
    同步日志表

    按天分区，记录每次同步任务的执行情况，
    包括同步了什么表、多少条记录、耗时、错误信息等。
    """

    __tablename__ = "sync_log"

    task_id = Column(
        String(100),
        nullable=False,
        index=True,
        comment="任务ID",
    )
    trace_id = Column(
        String(100),
        nullable=True,
        index=True,
        comment="追踪ID",
    )
    entity_type = Column(
        SAEnum(EntityType),
        nullable=False,
        index=True,
        comment="实体类型",
    )
    operation_type = Column(
        SAEnum(OperationType),
        nullable=False,
        index=True,
        comment="操作类型",
    )
    record_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="同步记录数",
    )
    success_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="成功记录数",
    )
    failed_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="失败记录数",
    )
    skipped_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="跳过记录数",
    )
    duration_ms = Column(
        BigInteger,
        default=0,
        nullable=False,
        comment="耗时(毫秒)",
    )
    status = Column(
        SAEnum(TaskStatus),
        default=TaskStatus.PENDING,
        nullable=False,
        index=True,
        comment="任务状态",
    )
    error_type = Column(
        String(200),
        nullable=True,
        comment="错误类型",
    )
    error_detail = Column(
        Text,
        nullable=True,
        comment="错误详情",
    )
    failed_records = Column(
        JSON,
        nullable=True,
        comment="失败记录详情(JSON数组)",
    )
    sync_source = Column(
        String(50),
        nullable=True,
        comment="同步触发来源",
    )
    extra_info = Column(
        JSON,
        nullable=True,
        comment="扩展信息",
    )
    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="开始时间",
    )
    finished_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="结束时间",
    )
    operator = Column(
        String(100),
        nullable=True,
        comment="操作人",
    )

    __table_args__ = (
        Index("idx_task_entity", "task_id", "entity_type"),
        Index("idx_status_created", "status", "created_at"),
        Index("idx_entity_created", "entity_type", "created_at"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "comment": "同步日志表"},
    )

    def mark_started(self) -> None:
        """标记任务开始"""
        self.status = TaskStatus.RUNNING
        self.started_at = datetime.utcnow()

    def mark_success(self, record_count: int) -> None:
        """标记任务成功"""
        self.status = TaskStatus.SUCCESS
        self.record_count = record_count
        self.success_count = record_count
        self.finished_at = datetime.utcnow()
        if self.started_at:
            self.duration_ms = int((self.finished_at - self.started_at).total_seconds() * 1000)

    def mark_failed(self, error_type: str, error_detail: str, record_count: int = 0) -> None:
        """标记任务失败"""
        self.status = TaskStatus.FAILED
        self.error_type = error_type
        self.error_detail = error_detail
        self.record_count = record_count
        self.failed_count = record_count
        self.finished_at = datetime.utcnow()
        if self.started_at:
            self.duration_ms = int((self.finished_at - self.started_at).total_seconds() * 1000)

    def mark_partial(
        self,
        success_count: int,
        failed_count: int,
        error_detail: str = "",
    ) -> None:
        """标记任务部分成功"""
        self.status = TaskStatus.PARTIAL
        self.success_count = success_count
        self.failed_count = failed_count
        self.record_count = success_count + failed_count
        self.error_detail = error_detail
        self.finished_at = datetime.utcnow()
        if self.started_at:
            self.duration_ms = int((self.finished_at - self.started_at).total_seconds() * 1000)


class SyncProgress(Base):
    """
    全量同步进度表

    记录全量同步任务的进度，用于长时间运行的全量同步任务。
    """

    __tablename__ = "sync_progress"

    task_id = Column(
        String(100),
        nullable=False,
        index=True,
        comment="任务ID",
    )
    entity_type = Column(
        SAEnum(EntityType),
        nullable=False,
        index=True,
        comment="实体类型",
    )
    total_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="总记录数",
    )
    processed_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="已处理记录数",
    )
    current_batch = Column(
        Integer,
        default=0,
        nullable=False,
        comment="当前批次",
    )
    total_batches = Column(
        Integer,
        default=0,
        nullable=False,
        comment="总批次数",
    )
    last_processed_id = Column(
        String(100),
        nullable=True,
        comment="最后处理的记录ID",
    )
    status = Column(
        SAEnum(TaskStatus),
        default=TaskStatus.PENDING,
        nullable=False,
        index=True,
        comment="进度状态",
    )
    progress_percent = Column(
        Integer,
        default=0,
        nullable=False,
        comment="进度百分比(0-100)",
    )
    estimated_remaining_ms = Column(
        BigInteger,
        default=0,
        nullable=False,
        comment="预计剩余时间(毫秒)",
    )

    __table_args__ = (
        Index("idx_task_entity", "task_id", "entity_type", unique=True),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "comment": "全量同步进度表"},
    )

    def update_progress(
        self,
        processed_count: int,
        last_processed_id: str,
        current_batch: int,
    ) -> None:
        """更新进度"""
        self.processed_count = processed_count
        self.last_processed_id = last_processed_id
        self.current_batch = current_batch

        if self.total_count > 0:
            self.progress_percent = min(100, int(processed_count / self.total_count * 100))
