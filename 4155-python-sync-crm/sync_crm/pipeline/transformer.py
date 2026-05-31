"""
数据转换器实现
包括字段映射和数据清洗
"""
import ast
from datetime import datetime
from typing import Any, Dict, Optional, List

from sqlalchemy.orm import Session

from sync_crm.config import settings
from sync_crm.models.field_mapping import (
    FieldMappingConfig,
    ConversionRule,
    MissingFieldAction,
    FieldType,
)
from sync_crm.models.mapping import EntityType
from sync_crm.pipeline.base import Transformer, PipelineContext
from sync_crm.utils.data_converter import (
    convert_date_format,
    normalize_phone,
    convert_currency,
    safe_cast,
)
from sync_crm.utils.sync_source import mark_sync_source, SyncOrigin
from sync_crm.infrastructure.logging import get_logger

logger = get_logger(__name__)


class FieldMappingTransformer(Transformer):
    """
    基于配置的字段映射转换器

    从数据库读取字段映射配置，自动完成字段映射和数据转换。
    """

    def __init__(self, entity_type: EntityType, direction: str, db_session: Session):
        super().__init__(entity_type)
        self.direction = direction
        self.db_session = db_session
        self._load_mappings()

    def _load_mappings(self) -> None:
        """加载字段映射配置"""
        self.mappings = FieldMappingConfig.get_mappings(
            self.db_session, self.entity_type, self.direction
        )
        logger.info(
            f"加载字段映射配置: entity={self.entity_type.value}, "
            f"direction={self.direction}, count={len(self.mappings)}"
        )

    def reload_mappings(self) -> None:
        """重新加载映射配置"""
        self._load_mappings()

    def transform(
        self,
        record: Dict[str, Any],
        context: PipelineContext,
    ) -> Optional[Dict[str, Any]]:
        """
        根据配置转换数据

        Args:
            record: 源数据记录
            context: 管道上下文

        Returns:
            转换后的数据，None表示跳过
        """
        result: Dict[str, Any] = {}
        skip_record = False

        for mapping in self.mappings:
            source_field = mapping.source_field
            target_field = mapping.target_field

            try:
                if source_field not in record:
                    action = mapping.missing_action
                    if action == MissingFieldAction.SKIP:
                        continue
                    elif action == MissingFieldAction.DEFAULT:
                        value = mapping.default_value
                    elif action == MissingFieldAction.NULL:
                        value = None
                    elif action == MissingFieldAction.ERROR:
                        if mapping.is_required:
                            logger.warning(
                                f"必填字段缺失: {source_field}, 跳过记录",
                                record_id=record.get("id"),
                            )
                            return None
                        value = None
                    else:
                        value = None
                else:
                    value = record[source_field]

                value = self._apply_conversion(
                    value=value,
                    rule=mapping.conversion_rule,
                    params=mapping.conversion_params,
                    source_type=mapping.source_field_type,
                    target_type=mapping.target_field_type,
                    default_value=mapping.default_value,
                    custom_expression=mapping.custom_expression,
                    record=record,
                )

                result[target_field] = value

            except Exception as e:
                logger.error(
                    f"字段转换失败: {source_field} -> {target_field}, error={e}",
                    record_id=record.get("id"),
                    exc_info=True,
                )
                if mapping.is_required:
                    return None

        origin = (
            SyncOrigin.CRM if self.direction == "crm_to_marketing" else SyncOrigin.MARKETING
        )
        result = mark_sync_source(
            result,
            origin=origin,
            source_field=settings.marketing.sync_source_field,
            origin_field=settings.marketing.origin_field,
        )

        return result if not skip_record else None

    def _apply_conversion(
        self,
        value: Any,
        rule: ConversionRule,
        params: Optional[Dict[str, Any]],
        source_type: FieldType,
        target_type: FieldType,
        default_value: Optional[str],
        custom_expression: Optional[str],
        record: Dict[str, Any],
    ) -> Any:
        """
        应用转换规则
        """
        if value is None and default_value is not None:
            value = default_value

        if value is None:
            return None

        if rule == ConversionRule.NONE:
            pass
        elif rule == ConversionRule.DATE_FORMAT:
            input_format = params.get("input_format") if params else None
            output_format = params.get("output_format", "%Y-%m-%d") if params else "%Y-%m-%d"
            value = convert_date_format(str(value), input_format, output_format)
        elif rule == ConversionRule.PHONE_NORMALIZE:
            add_prefix = params.get("add_prefix", False) if params else False
            prefix = params.get("prefix", "86") if params else "86"
            value = normalize_phone(str(value), add_prefix=add_prefix, prefix=prefix)
        elif rule == ConversionRule.CURRENCY_YUAN_TO_WAN:
            value = convert_currency(safe_cast(value, float, 0.0), "yuan", "wan")
        elif rule == ConversionRule.CURRENCY_WAN_TO_YUAN:
            value = convert_currency(safe_cast(value, float, 0.0), "wan", "yuan")
        elif rule == ConversionRule.TO_UPPER:
            value = str(value).upper()
        elif rule == ConversionRule.TO_LOWER:
            value = str(value).lower()
        elif rule == ConversionRule.TRIM:
            value = str(value).strip()
        elif rule == ConversionRule.DEFAULT_VALUE:
            if value is None or value == "":
                value = default_value
        elif rule == ConversionRule.CUSTOM_EXPRESSION and custom_expression:
            value = self._evaluate_expression(custom_expression, value, record)

        if target_type == FieldType.INTEGER:
            value = safe_cast(value, int, 0)
        elif target_type == FieldType.FLOAT:
            value = safe_cast(value, float, 0.0)
        elif target_type == FieldType.BOOLEAN:
            value = safe_cast(value, bool, False)
        elif target_type == FieldType.STRING:
            value = str(value) if value is not None else None
        elif target_type == FieldType.DATE:
            if isinstance(value, datetime):
                value = value.strftime("%Y-%m-%d")
        elif target_type == FieldType.DATETIME:
            if isinstance(value, datetime):
                value = value.strftime("%Y-%m-%d %H:%M:%S")

        return value

    def _evaluate_expression(
        self,
        expression: str,
        current_value: Any,
        record: Dict[str, Any],
    ) -> Any:
        """
        执行自定义转换表达式

        安全地执行Python表达式，可访问:
        - value: 当前字段值
        - record: 整条记录
        - datetime: datetime模块
        """
        try:
            safe_globals = {
                "__builtins__": {
                    "str": str,
                    "int": int,
                    "float": float,
                    "bool": bool,
                    "len": len,
                    "lower": str.lower,
                    "upper": str.upper,
                    "strip": str.strip,
                    "replace": str.replace,
                    "split": str.split,
                    "join": str.join,
                },
                "datetime": __import__("datetime"),
            }
            safe_locals = {
                "value": current_value,
                "record": record,
            }
            result = eval(expression, safe_globals, safe_locals)
            return result
        except Exception as e:
            logger.error(f"自定义表达式执行失败: {expression}, error={e}")
            return current_value


class DataCleaningTransformer(Transformer):
    """
    数据清洗转换器

    进行通用数据清洗：去重、格式标准化、空值处理等。
    """

    def __init__(self, entity_type: EntityType, dedup_fields: Optional[List[str]] = None):
        super().__init__(entity_type)
        self.dedup_fields = dedup_fields or []
        self._seen_hashes = set()

    def transform(
        self,
        record: Dict[str, Any],
        context: PipelineContext,
    ) -> Optional[Dict[str, Any]]:
        """
        清洗数据

        Args:
            record: 源数据记录
            context: 管道上下文

        Returns:
            清洗后的数据，None表示去重跳过
        """
        if self.dedup_fields:
            from sync_crm.utils.id_generator import generate_record_hash

            record_hash = generate_record_hash(record, self.dedup_fields)
            if record_hash in self._seen_hashes:
                context.records_skipped += 1
                logger.debug(f"去重跳过记录: {record.get('id')}")
                return None
            self._seen_hashes.add(record_hash)

        cleaned = {}
        for key, value in record.items():
            if isinstance(value, str):
                value = value.strip()
                if value == "":
                    value = None
            cleaned[key] = value

        if "phone" in cleaned and cleaned["phone"]:
            cleaned["phone"] = normalize_phone(cleaned["phone"])

        if "email" in cleaned and cleaned["email"]:
            cleaned["email"] = cleaned["email"].lower().strip()

        return cleaned

    def clear_dedup_cache(self) -> None:
        """清远去重缓存"""
        self._seen_hashes.clear()
