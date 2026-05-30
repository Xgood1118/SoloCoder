from __future__ import annotations

import abc
import re
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union

from data_io.models import Record
from data_io.models import ValidationResult, ValidationError


T = TypeVar("T", bound="ValidationRule")


class ValidationRule(abc.ABC):
    def __init__(self, field_name: str, message: Optional[str] = None):
        self.field_name = field_name
        self.message = message or "Validation failed"
        self._next: Optional["ValidationRule"] = None

    @abc.abstractmethod
    def validate(self, value: Any, record: Record) -> bool:
        ...

    def and_then(self: T, next_rule: "ValidationRule") -> T:
        if self._next is None:
            self._next = next_rule
        else:
            self._next.and_then(next_rule)
        return self

    def apply(
        self,
        record: Record,
        result: ValidationResult,
    ) -> None:
        value = record.data.get(self.field_name)
        if not self.validate(value, record):
            result.add_error(
                ValidationError(
                    row_index=record.row_index,
                    field_name=self.field_name,
                    rule_name=self.__class__.__name__,
                    message=self.message,
                    value=value,
                )
            )
            return
        if self._next:
            self._next.apply(record, result)


class RequiredRule(ValidationRule):
    def __init__(self, field_name: str, message: Optional[str] = None):
        super().__init__(field_name, message or f"{field_name} is required")

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return False
        if isinstance(value, str) and value.strip() == "":
            return False
        return True


class NotEmptyRule(ValidationRule):
    def __init__(self, field_name: str, message: Optional[str] = None):
        super().__init__(field_name, message or f"{field_name} cannot be empty")

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        if isinstance(value, str) and value.strip() == "":
            return False
        if isinstance(value, (list, dict, set)) and len(value) == 0:
            return False
        return True


class MaxLengthRule(ValidationRule):
    def __init__(self, field_name: str, max_length: int, message: Optional[str] = None):
        super().__init__(
            field_name,
            message or f"{field_name} length exceeds {max_length}"
        )
        self.max_length = max_length

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        return len(str(value)) <= self.max_length


class MinLengthRule(ValidationRule):
    def __init__(self, field_name: str, min_length: int, message: Optional[str] = None):
        super().__init__(
            field_name,
            message or f"{field_name} length less than {min_length}"
        )
        self.min_length = min_length

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return False
        return len(str(value)) >= self.min_length


class MinValueRule(ValidationRule):
    def __init__(self, field_name: str, min_value: Union[int, float], message: Optional[str] = None):
        super().__init__(
            field_name,
            message or f"{field_name} less than {min_value}"
        )
        self.min_value = min_value

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        try:
            return float(value) >= self.min_value
        except (ValueError, TypeError):
            return False


class MaxValueRule(ValidationRule):
    def __init__(self, field_name: str, max_value: Union[int, float], message: Optional[str] = None):
        super().__init__(
            field_name,
            message or f"{field_name} greater than {max_value}"
        )
        self.max_value = max_value

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        try:
            return float(value) <= self.max_value
        except (ValueError, TypeError):
            return False


class RangeRule(ValidationRule):
    def __init__(
        self,
        field_name: str,
        min_value: Union[int, float],
        max_value: Union[int, float],
        message: Optional[str] = None,
    ):
        super().__init__(
            field_name,
            message or f"{field_name} must be between {min_value} and {max_value}"
        )
        self.min_value = min_value
        self.max_value = max_value

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        try:
            num = float(value)
            return self.min_value <= num <= self.max_value
        except (ValueError, TypeError):
            return False


class InEnumRule(ValidationRule):
    def __init__(self, field_name: str, allowed_values: list, message: Optional[str] = None):
        super().__init__(
            field_name,
            message or f"{field_name} must be one of {allowed_values}"
        )
        self.allowed_values = set(allowed_values)

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        return value in self.allowed_values


class RegexRule(ValidationRule):
    def __init__(self, field_name: str, pattern: str, message: Optional[str] = None):
        super().__init__(field_name, message or f"{field_name} format invalid")
        self.pattern = re.compile(pattern)

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        return bool(self.pattern.match(str(value)))


class EmailRule(RegexRule):
    def __init__(self, field_name: str, message: Optional[str] = None):
        super().__init__(
            field_name,
            r"^[\w.-]+@[\w.-]+\.\w+$",
            message or f"{field_name} is not a valid email"
        )


class PhoneRule(RegexRule):
    def __init__(self, field_name: str, message: Optional[str] = None):
        super().__init__(
            field_name,
            r"^1[3-9]\d{9}$",
            message or f"{field_name} is not a valid phone number"
        )


class DateRule(ValidationRule):
    def __init__(self, field_name: str, message: Optional[str] = None):
        super().__init__(
            field_name,
            message or f"{field_name} is not a valid date"
        )

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        from data_io.utils.date_utils import is_valid_date
        return is_valid_date(value)


class IntegerRule(ValidationRule):
    def __init__(self, field_name: str, message: Optional[str] = None):
        super().__init__(
            field_name,
            message or f"{field_name} is not a valid integer"
        )

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        if isinstance(value, int):
            return True
        if isinstance(value, float):
            return value == int(value)
        try:
            int(str(value))
            return True
        except ValueError:
            return False


class FloatRule(ValidationRule):
    def __init__(self, field_name: str, message: Optional[str] = None):
        super().__init__(
            field_name,
            message or f"{field_name} is not a valid number"
        )

    def validate(self, value: Any, record: Record) -> bool:
        if value is None:
            return True
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False


class CustomRule(ValidationRule):
    def __init__(
        self,
        field_name: str,
        func: Callable[[Any, Record], bool],
        message: Optional[str] = None,
    ):
        super().__init__(field_name, message or f"{field_name} validation failed")
        self.func = func

    def validate(self, value: Any, record: Record) -> bool:
        try:
            return bool(self.func(value, record))
        except Exception:
            return False


RULE_REGISTRY: Dict[str, type[ValidationRule]] = {
    "required": RequiredRule,
    "not_empty": NotEmptyRule,
    "max_length": MaxLengthRule,
    "min_length": MinLengthRule,
    "min_value": MinValueRule,
    "max_value": MaxValueRule,
    "range": RangeRule,
    "in": InEnumRule,
    "regex": RegexRule,
    "email": EmailRule,
    "phone": PhoneRule,
    "date": DateRule,
    "integer": IntegerRule,
    "float": FloatRule,
}


def register_rule(name: str, rule_class: type[ValidationRule]) -> None:
    RULE_REGISTRY[name] = rule_class


def create_rule(rule_type: str, field_name: str, **kwargs) -> ValidationRule:
    if rule_type not in RULE_REGISTRY:
        raise ValueError(f"Unknown rule type: {rule_type}")
    return RULE_REGISTRY[rule_type](field_name, **kwargs)
