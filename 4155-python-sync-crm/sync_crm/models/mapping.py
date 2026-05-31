"""
同步映射表模型
记录CRM和营销平台之间的ID映射关系
"""
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Column, String, Integer, DateTime, BigInteger, Index, UniqueConstraint
from sqlalchemy import Enum as SAEnum

from sync_crm.models.base import Base


class MappingStatus(str, PyEnum):
    """映射状态枚举"""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"
    PENDING = "pending"
    CONFLICT = "conflict"


class EntityType(str, PyEnum):
    """实体类型枚举"""

    CUSTOMER = "customer"
    CONTACT = "contact"
    LEAD = "lead"
    ORDER = "order"
    OPPORTUNITY = "opportunity"


class SyncMapping(Base):
    """
    同步映射表

    记录每条记录在CRM(本地)和营销平台(远程)的ID对应关系，
    使用sync_version做乐观锁，防止并发更新覆盖。
    """

    __tablename__ = "sync_mapping"

    local_id = Column(
        String(100),
        nullable=False,
        index=True,
        comment="本地系统(CRM)记录ID",
    )
    remote_id = Column(
        String(100),
        nullable=True,
        index=True,
        comment="远程系统(营销平台)记录ID",
    )
    entity_type = Column(
        SAEnum(EntityType),
        nullable=False,
        index=True,
        comment="实体类型",
    )
    last_sync_time = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="最后同步时间",
    )
    sync_version = Column(
        BigInteger,
        default=1,
        nullable=False,
        comment="同步版本号（乐观锁）",
    )
    status = Column(
        SAEnum(MappingStatus),
        default=MappingStatus.ACTIVE,
        nullable=False,
        index=True,
        comment="映射状态",
    )
    sync_source = Column(
        String(50),
        nullable=True,
        comment="数据来源标记（防循环同步）",
    )
    data_hash = Column(
        String(64),
        nullable=True,
        comment="数据内容哈希（用于去重）",
    )
    error_message = Column(
        String(1000),
        nullable=True,
        comment="错误信息",
    )

    __table_args__ = (
        UniqueConstraint("local_id", "entity_type", name="uk_local_entity"),
        UniqueConstraint("remote_id", "entity_type", name="uk_remote_entity"),
        Index("idx_entity_status", "entity_type", "status"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "comment": "ID映射表"},
    )

    def increment_version(self) -> None:
        """递增版本号（乐观锁）"""
        self.sync_version += 1

    def mark_deleted(self) -> None:
        """软删除标记"""
        self.status = MappingStatus.DELETED

    def mark_conflict(self, error_msg: str) -> None:
        """标记冲突"""
        self.status = MappingStatus.CONFLICT
        self.error_message = error_msg

    @classmethod
    def find_by_local(
        cls,
        session,
        local_id: str,
        entity_type: EntityType,
    ) -> Optional["SyncMapping"]:
        """根据本地ID查找映射"""
        return (
            session.query(cls)
            .filter(
                cls.local_id == local_id,
                cls.entity_type == entity_type,
                cls.status != MappingStatus.DELETED,
            )
            .first()
        )

    @classmethod
    def find_by_remote(
        cls,
        session,
        remote_id: str,
        entity_type: EntityType,
    ) -> Optional["SyncMapping"]:
        """根据远程ID查找映射"""
        return (
            session.query(cls)
            .filter(
                cls.remote_id == remote_id,
                cls.entity_type == entity_type,
                cls.status != MappingStatus.DELETED,
            )
            .first()
        )
