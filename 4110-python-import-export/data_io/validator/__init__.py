from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Union

from data_io.models import Record
from data_io.models import ValidationResult, ValidationError
from data_io.validator.rules import (
    ValidationRule,
    create_rule,
    register_rule,
    RequiredRule,
    NotEmptyRule,
    MaxLengthRule,
    MinLengthRule,
    MinValueRule,
    MaxValueRule,
    RangeRule,
    InEnumRule,
    RegexRule,
    EmailRule,
    PhoneRule,
    DateRule,
    IntegerRule,
    FloatRule,
    CustomRule,
)


class Validator:
    def __init__(self, rules: Optional[List[ValidationRule]] = None):
        self._rules: List[ValidationRule] = rules or []

    def add_rule(self, rule: ValidationRule) -> "Validator":
        self._rules.append(rule)
        return self

    def add_rules(self, rules: List[ValidationRule]) -> "Validator":
        self._rules.extend(rules)
        return self

    def add_required(self, field_name: str, message: Optional[str] = None) -> "Validator":
        return self.add_rule(RequiredRule(field_name, message))

    def add_email(self, field_name: str, message: Optional[str] = None) -> "Validator":
        return self.add_rule(EmailRule(field_name, message))

    def add_phone(self, field_name: str, message: Optional[str] = None) -> "Validator":
        return self.add_rule(PhoneRule(field_name, message))

    def add_date(self, field_name: str, message: Optional[str] = None) -> "Validator":
        return self.add_rule(DateRule(field_name, message))

    def add_integer(self, field_name: str, message: Optional[str] = None) -> "Validator":
        return self.add_rule(IntegerRule(field_name, message))

    def add_float(self, field_name: str, message: Optional[str] = None) -> "Validator":
        return self.add_rule(FloatRule(field_name, message))

    def add_range(
        self,
        field_name: str,
        min_value: Union[int, float],
        max_value: Union[int, float],
        message: Optional[str] = None,
    ) -> "Validator":
        return self.add_rule(RangeRule(field_name, min_value, max_value, message))

    def add_in(
        self,
        field_name: str,
        allowed_values: list,
        message: Optional[str] = None,
    ) -> "Validator":
        return self.add_rule(InEnumRule(field_name, allowed_values, message))

    def add_custom(
        self,
        field_name: str,
        func: Callable[[Any, Record], bool],
        message: Optional[str] = None,
    ) -> "Validator":
        return self.add_rule(CustomRule(field_name, func, message))

    def from_config(self, config: Dict[str, List[Dict]]) -> "Validator":
        for field_name, field_rules in config.items():
            for rule_cfg in field_rules:
                rule_type = rule_cfg.pop("type")
                rule = create_rule(rule_type, field_name, **rule_cfg)
                self._rules.append(rule)
        return self

    def validate_record(self, record: Record) -> ValidationResult:
        result = ValidationResult()
        for rule in self._rules:
            rule.apply(record, result)
        return result

    def validate(self, records: List[Record]) -> ValidationResult:
        total_result = ValidationResult()
        for record in records:
            result = self.validate_record(record)
            if not result.is_valid:
                record.errors.extend(result.errors)
                total_result.merge(result)
        return total_result

    def validate_iter(
        self,
        records: List[Record],
        collect_errors: bool = True,
    ) -> ValidationResult:
        total_result = ValidationResult()
        for record in records:
            result = self.validate_record(record)
            if not result.is_valid:
                record.errors.extend(result.errors)
                if collect_errors:
                    total_result.merge(result)
        return total_result

    @property
    def rules(self) -> List[ValidationRule]:
        return list(self._rules)

    def clear(self) -> None:
        self._rules.clear()


__all__ = [
    "Validator",
    "ValidationRule",
    "RequiredRule",
    "NotEmptyRule",
    "MaxLengthRule",
    "MinLengthRule",
    "MinValueRule",
    "MaxValueRule",
    "RangeRule",
    "InEnumRule",
    "RegexRule",
    "EmailRule",
    "PhoneRule",
    "DateRule",
    "IntegerRule",
    "FloatRule",
    "CustomRule",
    "register_rule",
    "create_rule",
]
