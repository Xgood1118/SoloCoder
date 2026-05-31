from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, Dict, Any

from sqlalchemy import DateTime, Enum, Integer, String, Text, JSON, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from crm_sync.infrastructure.database import Base


class TaskType(str, PyEnum):
    CUSTOMER_SYNC = "customer_sync"
    CONTACT_SYNC = "contact_sync"
    LEAD_SYNC = "lead_sync"
    ORDER_SYNC = "order_sync"
    FULL_SYNC = "full_sync"
    DATA_VALIDATION = "data_validation"


class TaskStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SCHEDULED = "scheduled"


class SyncTask(Base):
    __tablename__ = "sync_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    task_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    task_type: Mapped[TaskType] = mapped_column(
        Enum(TaskType), nullable=False, index=True
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), nullable=False, index=True
    )
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    cron_expression: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    params: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, nullable=False)
    total_count: Mapped[int] = mapped_column(Integer, nullable=False)
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scheduled_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    __table_args__ = (
        Index("idx_task_type_status", "task_type", "status"),
        Index("idx_task_created_at", "created_at"),
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.status is None:
            self.status = TaskStatus.PENDING
        if self.params is None:
            self.params = {}
        if self.progress is None:
            self.progress = 0
        if self.total_count is None:
            self.total_count = 0
        if self.created_by is None:
            self.created_by = "system"
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()

    def start(self) -> None:
        self.status = TaskStatus.RUNNING
        self.start_time = datetime.utcnow()
        self.progress = 0

    def update_progress(self, current: int, total: Optional[int] = None) -> None:
        self.progress = current
        if total is not None:
            self.total_count = total

    def complete(self, result: Optional[str] = None) -> None:
        self.status = TaskStatus.COMPLETED
        self.end_time = datetime.utcnow()
        self.progress = 100
        if result:
            self.result = result

    def fail(self, error_message: str) -> None:
        self.status = TaskStatus.FAILED
        self.end_time = datetime.utcnow()
        self.error_message = error_message

    def cancel(self) -> None:
        self.status = TaskStatus.CANCELLED
        self.end_time = datetime.utcnow()

    def get_duration(self) -> Optional[int]:
        if self.start_time and self.end_time:
            return int((self.end_time - self.start_time).total_seconds())
        return None

    def is_running(self) -> bool:
        return self.status == TaskStatus.RUNNING

    def is_completed(self) -> bool:
        return self.status == TaskStatus.COMPLETED

    def is_failed(self) -> bool:
        return self.status == TaskStatus.FAILED
