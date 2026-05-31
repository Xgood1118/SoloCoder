from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from crm_sync.infrastructure.database import Base


class SyncStatus(str, PyEnum):
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"


class OperationType(str, PyEnum):
    INSERT = "insert"
    UPDATE = "update"
    DELETE = "delete"
    UPSERT = "upsert"
    FULL_SYNC = "full_sync"
    INCREMENTAL_SYNC = "incremental_sync"
    INCREMENTAL = "incremental"


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    task_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    operation_type: Mapped[OperationType] = mapped_column(
        Enum(OperationType), nullable=False, index=True
    )
    record_count: Mapped[int] = mapped_column(Integer, nullable=False)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[SyncStatus] = mapped_column(
        Enum(SyncStatus), nullable=False, index=True
    )
    error_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sync_source: Mapped[str] = mapped_column(String(50), nullable=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False
    )
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    __table_args__ = (
        Index("idx_log_task_entity", "task_id", "entity_type"),
        Index("idx_log_created_at", "created_at"),
        Index("idx_log_status_created", "status", "created_at"),
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        now = datetime.utcnow()
        if self.record_count is None:
            self.record_count = 0
        if self.success_count is None:
            self.success_count = 0
        if self.failed_count is None:
            self.failed_count = 0
        if self.skipped_count is None:
            self.skipped_count = 0
        if self.duration_ms is None:
            self.duration_ms = 0
        if self.status is None:
            self.status = SyncStatus.PENDING
        if self.start_time is None:
            self.start_time = now
        if self.created_at is None:
            self.created_at = now

    def complete(
        self,
        success_count: int = 0,
        failed_count: int = 0,
        skipped_count: int = 0,
        error_detail: Optional[str] = None,
    ) -> None:
        self.end_time = datetime.utcnow()
        self.success_count = success_count
        self.failed_count = failed_count
        self.skipped_count = skipped_count
        self.duration_ms = int((self.end_time - self.start_time).total_seconds() * 1000)

        if failed_count == 0 and skipped_count == 0:
            self.status = SyncStatus.SUCCESS
        elif success_count == 0:
            self.status = SyncStatus.FAILED
        else:
            self.status = SyncStatus.PARTIAL

        if error_detail:
            self.error_detail = error_detail

    def start(self) -> None:
        self.status = SyncStatus.RUNNING
        self.start_time = datetime.utcnow()

    def fail(self, error_detail: str) -> None:
        self.end_time = datetime.utcnow()
        self.status = SyncStatus.FAILED
        self.error_detail = error_detail
        self.duration_ms = int((self.end_time - self.start_time).total_seconds() * 1000)
