"""
SQLAlchemy基础模型
"""
from datetime import datetime, timezone
from typing import Any

import pytz
from sqlalchemy import Column, DateTime, Integer, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import declared_attr

from sync_crm.config import settings
from sync_crm.utils.data_converter import format_datetime_utc


def _utc_now() -> datetime:
    """获取当前UTC时间"""
    return datetime.now(pytz.UTC) if settings.sync.utc_storage else datetime.now()


class BaseModel:
    """基础模型类"""

    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower()

    id = Column(Integer, primary_key=True, autoincrement=True, index=True, comment="主键ID")
    created_at = Column(
        DateTime(timezone=True),
        default=_utc_now,
        nullable=False,
        comment="创建时间",
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=_utc_now,
        onupdate=_utc_now,
        nullable=False,
        comment="更新时间",
    )

    def to_dict(self) -> dict:
        """转换为字典"""
        data = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                data[column.name] = format_datetime_utc(value)
            else:
                data[column.name] = value
        return data

    def update_from_dict(self, data: dict) -> None:
        """从字典更新字段"""
        for key, value in data.items():
            if hasattr(self, key) and key not in ["id", "created_at", "updated_at"]:
                setattr(self, key, value)


Base = declarative_base(cls=BaseModel)
