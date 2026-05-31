"""
字段映射配置表模型
支持可配置的字段映射关系和数据转换规则
"""
from enum import Enum as PyEnum
from typing import Optional, Dict, Any

from sqlalchemy import Column, String, Integer, Boolean, JSON, Index, UniqueConstraint, Text
from sqlalchemy import Enum as SAEnum

from sync_crm.models.base import Base
from sync_crm.models.mapping import EntityType


class FieldType(str, PyEnum):
    """字段类型枚举"""

    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    JSON = "json"


class ConversionRule(str, PyEnum):
    """转换规则枚举"""

    NONE = "none"
    DATE_FORMAT = "date_format"
    PHONE_NORMALIZE = "phone_normalize"
    CURRENCY_YUAN_TO_WAN = "currency_yuan_to_wan"
    CURRENCY_WAN_TO_YUAN = "currency_wan_to_yuan"
    TO_UPPER = "to_upper"
    TO_LOWER = "to_lower"
    TRIM = "trim"
    DEFAULT_VALUE = "default_value"
    CUSTOM_EXPRESSION = "custom_expression"


class MissingFieldAction(str, PyEnum):
    """缺失字段处理方式"""

    SKIP = "skip"
    DEFAULT = "default"
    NULL = "null"
    ERROR = "error"


class FieldMappingConfig(Base):
    """
    字段映射配置表

    存储CRM和营销平台之间的字段映射关系，
    包括转换规则、默认值、缺失字段处理策略等。
    """

    __tablename__ = "field_mapping_config"

    entity_type = Column(
        SAEnum(EntityType),
        nullable=False,
        index=True,
        comment="实体类型",
    )
    direction = Column(
        String(20),
        default="crm_to_marketing",
        nullable=False,
        comment="同步方向: crm_to_marketing / marketing_to_crm / bidirectional",
    )
    source_field = Column(
        String(200),
        nullable=False,
        comment="源字段名",
    )
    target_field = Column(
        String(200),
        nullable=False,
        comment="目标字段名",
    )
    source_field_type = Column(
        SAEnum(FieldType),
        default=FieldType.STRING,
        nullable=False,
        comment="源字段类型",
    )
    target_field_type = Column(
        SAEnum(FieldType),
        default=FieldType.STRING,
        nullable=False,
        comment="目标字段类型",
    )
    conversion_rule = Column(
        SAEnum(ConversionRule),
        default=ConversionRule.NONE,
        nullable=False,
        comment="转换规则",
    )
    conversion_params = Column(
        JSON,
        nullable=True,
        comment="转换参数(JSON)",
    )
    missing_action = Column(
        SAEnum(MissingFieldAction),
        default=MissingFieldAction.DEFAULT,
        nullable=False,
        comment="缺失字段处理方式",
    )
    default_value = Column(
        String(500),
        nullable=True,
        comment="默认值",
    )
    is_required = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="是否必填",
    )
    is_primary_key = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="是否主键字段",
    )
    custom_expression = Column(
        Text,
        nullable=True,
        comment="自定义转换表达式(Python代码)",
    )
    description = Column(
        String(500),
        nullable=True,
        comment="字段说明",
    )
    sort_order = Column(
        Integer,
        default=0,
        nullable=False,
        comment="排序顺序",
    )
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="是否启用",
    )

    __table_args__ = (
        UniqueConstraint(
            "entity_type",
            "direction",
            "source_field",
            "target_field",
            name="uk_entity_direction_fields",
        ),
        Index("idx_entity_direction", "entity_type", "direction", "is_active"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "comment": "字段映射配置表"},
    )

    @classmethod
    def get_mappings(
        cls,
        session,
        entity_type: EntityType,
        direction: str = "crm_to_marketing",
    ) -> list:
        """获取指定实体和方向的字段映射配置"""
        return (
            session.query(cls)
            .filter(
                cls.entity_type == entity_type,
                cls.direction.in_([direction, "bidirectional"]),
                cls.is_active == True,
            )
            .order_by(cls.sort_order)
            .all()
        )

    def to_mapping_dict(self) -> Dict[str, Any]:
        """转换为映射字典"""
        return {
            "source": self.source_field,
            "target": self.target_field,
            "source_type": self.source_field_type,
            "target_type": self.target_field_type,
            "conversion_rule": self.conversion_rule,
            "conversion_params": self.conversion_params,
            "missing_action": self.missing_action,
            "default_value": self.default_value,
            "is_required": self.is_required,
            "custom_expression": self.custom_expression,
        }
