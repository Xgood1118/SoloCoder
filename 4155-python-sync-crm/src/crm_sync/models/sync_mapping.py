from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, Enum, Integer, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from crm_sync.infrastructure.database import Base


class MappingStatus(str, PyEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"
    PENDING = "pending"
    ERROR = "error"


class SyncMapping(Base):
    __tablename__ = "sync_mappings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    local_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    remote_id: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sync_version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[MappingStatus] = mapped_column(
        Enum(MappingStatus), nullable=False, index=True
    )
    sync_source: Mapped[str] = mapped_column(String(50), nullable=True)
    last_sync_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False
    )
    deleted_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_local_entity", "local_id", "entity_type", unique=True),
        Index("idx_remote_entity", "remote_id", "entity_type", unique=True),
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        now = datetime.utcnow()
        if self.sync_version is None:
            self.sync_version = 1
        if self.status is None:
            self.status = MappingStatus.ACTIVE
        if self.last_sync_time is None:
            self.last_sync_time = now
        if self.created_at is None:
            self.created_at = now
        if self.updated_at is None:
            self.updated_at = now

    def increment_version(self) -> None:
        self.sync_version += 1

    def mark_deleted(self) -> None:
        self.status = MappingStatus.DELETED
        self.deleted_at = datetime.utcnow()

    def mark_error(self) -> None:
        self.status = MappingStatus.ERROR

    def mark_active(self) -> None:
        self.status = MappingStatus.ACTIVE

    def is_active(self) -> bool:
        return self.status == MappingStatus.ACTIVE
