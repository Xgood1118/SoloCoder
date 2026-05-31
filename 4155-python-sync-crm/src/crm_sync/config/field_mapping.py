import json
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class SyncDirection(str, Enum):
    CRM_TO_MARKETING = "crm_to_marketing"
    MARKETING_TO_CRM = "marketing_to_crm"
    BIDIRECTIONAL = "bidirectional"


class ConversionType(str, Enum):
    DATE_FORMAT = "date_format"
    PHONE_FORMAT = "phone_format"
    AMOUNT_SCALE = "amount_scale"
    ENUM_MAPPING = "enum_mapping"
    DEFAULT_VALUE = "default_value"
    CUSTOM = "custom"


class DataConversionRule(BaseModel):
    type: ConversionType
    params: Dict[str, Any] = Field(default_factory=dict)
    source_format: Optional[str] = None
    target_format: Optional[str] = None


class FieldMapping(BaseModel):
    source_field: str
    target_field: str
    direction: SyncDirection = SyncDirection.BIDIRECTIONAL
    required: bool = False
    conversion: Optional[DataConversionRule] = None
    default_value: Optional[Any] = None
    skip_if_empty: bool = False


class FieldMappingConfig(BaseModel):
    entity_type: str
    direction: SyncDirection
    mappings: List[FieldMapping]
    source_primary_key: str
    target_primary_key: str
    deduplication_fields: List[str] = Field(default_factory=list)

    @field_validator("mappings")
    @classmethod
    def validate_mappings(cls, v: List[FieldMapping]) -> List[FieldMapping]:
        if not v:
            raise ValueError("Field mappings cannot be empty")
        return v

    @model_validator(mode="after")
    def check_primary_keys(self) -> "FieldMappingConfig":
        source_fields = {m.source_field for m in self.mappings}
        target_fields = {m.target_field for m in self.mappings}
        if self.source_primary_key not in source_fields:
            raise ValueError(
                f"Source primary key {self.source_primary_key} not found in mappings"
            )
        if self.target_primary_key not in target_fields:
            raise ValueError(
                f"Target primary key {self.target_primary_key} not found in mappings"
            )
        return self


class FieldMappingValidator:
    @staticmethod
    def validate_customer_mapping(config: FieldMappingConfig) -> List[str]:
        errors = []
        required_fields = ["company_name", "contact", "phone"]
        mapped_fields = {m.source_field for m in config.mappings}
        for field in required_fields:
            if field not in mapped_fields:
                errors.append(f"Missing required customer field: {field}")
        return errors

    @staticmethod
    def validate_contact_mapping(config: FieldMappingConfig) -> List[str]:
        errors = []
        required_fields = ["name", "phone", "email"]
        mapped_fields = {m.source_field for m in config.mappings}
        for field in required_fields:
            if field not in mapped_fields:
                errors.append(f"Missing required contact field: {field}")
        return errors

    @staticmethod
    def validate_lead_mapping(config: FieldMappingConfig) -> List[str]:
        errors = []
        required_fields = ["phone", "company_name"]
        mapped_fields = {m.source_field for m in config.mappings}
        for field in required_fields:
            if field not in mapped_fields:
                errors.append(f"Missing required lead field: {field}")
        return errors

    @staticmethod
    def validate_order_mapping(config: FieldMappingConfig) -> List[str]:
        errors = []
        required_fields = ["order_no", "amount", "sign_date"]
        mapped_fields = {m.source_field for m in config.mappings}
        for field in required_fields:
            if field not in mapped_fields:
                errors.append(f"Missing required order field: {field}")
        return errors


def validate_field_mapping(config: FieldMappingConfig) -> List[str]:
    validators = {
        "customer": FieldMappingValidator.validate_customer_mapping,
        "contact": FieldMappingValidator.validate_contact_mapping,
        "lead": FieldMappingValidator.validate_lead_mapping,
        "order": FieldMappingValidator.validate_order_mapping,
    }
    validator = validators.get(config.entity_type)
    if validator:
        return validator(config)
    return []


def load_field_mapping(file_path: str) -> FieldMappingConfig:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Field mapping file not found: {file_path}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return FieldMappingConfig(**data)


def save_field_mapping(config: FieldMappingConfig, file_path: str) -> None:
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config.model_dump(), f, ensure_ascii=False, indent=2)


class DataTransformer:
    @staticmethod
    def convert_date(value: str, source_format: str, target_format: str) -> str:
        if not value:
            return ""
        try:
            dt = datetime.strptime(value, source_format)
            return dt.strftime(target_format)
        except ValueError:
            return value

    @staticmethod
    def format_phone(value: str, add_prefix: bool = True, prefix: str = "86") -> str:
        if not value:
            return ""
        digits = "".join(filter(str.isdigit, value))
        if add_prefix and not digits.startswith(prefix):
            return f"+{prefix}{digits}"
        return digits

    @staticmethod
    def scale_amount(value: float, scale: float = 0.0001) -> float:
        if value is None:
            return 0.0
        return float(value) * scale

    @staticmethod
    def map_enum(value: str, mapping: Dict[str, str]) -> str:
        return mapping.get(value, value)


def apply_field_mapping(
    data: Dict[str, Any], mapping_config: FieldMappingConfig, is_crm_source: bool
) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for mapping in mapping_config.mappings:
        if is_crm_source:
            if mapping.direction == SyncDirection.MARKETING_TO_CRM:
                continue
            source_val = data.get(mapping.source_field)
            target_field = mapping.target_field
        else:
            if mapping.direction == SyncDirection.CRM_TO_MARKETING:
                continue
            source_val = data.get(mapping.target_field)
            target_field = mapping.source_field
        if source_val is None or source_val == "":
            if mapping.skip_if_empty:
                continue
            if mapping.default_value is not None:
                result[target_field] = mapping.default_value
            continue
        if mapping.conversion:
            source_val = _apply_conversion(source_val, mapping.conversion)
        result[target_field] = source_val
    return result


def _apply_conversion(value: Any, rule: DataConversionRule) -> Any:
    if rule.type == ConversionType.DATE_FORMAT:
        return DataTransformer.convert_date(
            value,
            rule.params.get("source_format", "%Y-%m-%d"),
            rule.params.get("target_format", "%Y/%m/%d"),
        )
    elif rule.type == ConversionType.PHONE_FORMAT:
        return DataTransformer.format_phone(
            value,
            rule.params.get("add_prefix", True),
            rule.params.get("prefix", "86"),
        )
    elif rule.type == ConversionType.AMOUNT_SCALE:
        return DataTransformer.scale_amount(
            value, rule.params.get("scale", 0.0001)
        )
    elif rule.type == ConversionType.ENUM_MAPPING:
        return DataTransformer.map_enum(
            value, rule.params.get("mapping", {})
        )
    return value
