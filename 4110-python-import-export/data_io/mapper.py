from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Union

from data_io.models import Record, FieldMapping


TRANSFORM_REGISTRY: Dict[str, Callable[[Any], Any]] = {}


def register_transform(name: str, func: Callable[[Any], Any]) -> None:
    TRANSFORM_REGISTRY[name] = func


def get_transform(name: str) -> Optional[Callable[[Any], Any]]:
    return TRANSFORM_REGISTRY.get(name)


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        if isinstance(value, float):
            return int(value) if value == int(value) else None
        return int(value)
    except (ValueError, TypeError):
        return None


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _to_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value)


def _to_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    val = str(value).lower()
    if val in ("true", "1", "yes", "y"):
        return True
    if val in ("false", "0", "no", "n"):
        return False
    return None


def _strip(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value).strip()


def _lower(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value).lower()


def _upper(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value).upper()


def _divide_100(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value) / 100
    except (ValueError, TypeError):
        return None


def _multiply_100(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(float(value) * 100)
    except (ValueError, TypeError):
        return None


def _format_date_ymd(value: Any) -> Optional[str]:
    from data_io.utils.date_utils import format_date
    return format_date(value, "%Y-%m-%d")


def _format_date_full(value: Any) -> Optional[str]:
    from data_io.utils.date_utils import format_date
    return format_date(value, "%Y-%m-%d %H:%M:%S")


register_transform("to_int", _to_int)
register_transform("to_float", _to_float)
register_transform("to_str", _to_str)
register_transform("to_bool", _to_bool)
register_transform("strip", _strip)
register_transform("lower", _lower)
register_transform("upper", _upper)
register_transform("divide_100", _divide_100)
register_transform("multiply_100", _multiply_100)
register_transform("format_date_ymd", _format_date_ymd)
register_transform("format_date_full", _format_date_full)


class TransformChain:
    def __init__(self, transforms: Optional[List[Callable[[Any], Any]]] = None):
        self._transforms: List[Callable[[Any], Any]] = transforms or []

    def add(self, transform: Callable[[Any], Any]) -> "TransformChain":
        self._transforms.append(transform)
        return self

    def add_by_name(self, name: str) -> "TransformChain":
        transform = get_transform(name)
        if transform is None:
            raise ValueError(f"Unknown transform: {name}")
        return self.add(transform)

    def apply(self, value: Any) -> Any:
        for transform in self._transforms:
            value = transform(value)
        return value


class Mapper:
    def __init__(self, mappings: Optional[List[FieldMapping]] = None):
        self._mappings: List[FieldMapping] = mappings or []
        self._transform_chains: Dict[str, TransformChain] = {}

    def add_mapping(
        self,
        source_field: str,
        target_field: Optional[str] = None,
        transform: Optional[Union[Callable[[Any], Any], str, List[str]]] = None,
        default: Any = None,
        required: bool = False,
    ) -> "Mapper":
        target = target_field or source_field
        if isinstance(transform, str):
            tf = get_transform(transform)
        elif isinstance(transform, list):
            chain = TransformChain()
            for name in transform:
                chain.add_by_name(name)
            tf = chain.apply
        else:
            tf = transform
        self._mappings.append(
            FieldMapping(
                source_field=source_field,
                target_field=target,
                transform=tf,
                default=default,
                required=required,
            )
        )
        return self

    def from_config(
        self,
        config: Dict[str, Dict],
    ) -> "Mapper":
        for source, cfg in config.items():
            self.add_mapping(
                source_field=source,
                target_field=cfg.get("target", source),
                transform=cfg.get("transform"),
                default=cfg.get("default"),
                required=cfg.get("required", False),
            )
        return self

    def map_record(self, record: Record) -> Dict[str, Any]:
        result = {}
        for mapping in self._mappings:
            value = record.data.get(mapping.source_field, mapping.default)
            if mapping.transform:
                try:
                    value = mapping.transform(value)
                except Exception:
                    value = mapping.default
            result[mapping.target_field] = value
        return result

    def map_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        for mapping in self._mappings:
            value = data.get(mapping.source_field, mapping.default)
            if mapping.transform:
                try:
                    value = mapping.transform(value)
                except Exception:
                    value = mapping.default
            result[mapping.target_field] = value
        return result

    def map(self, records: List[Record]) -> List[Dict[str, Any]]:
        return [self.map_record(r) for r in records]

    def add_computed_field(
        self,
        target_field: str,
        func: Callable[[Dict[str, Any]], Any],
        depends_on: Optional[List[str]] = None,
    ) -> "Mapper":
        mapping = FieldMapping(
            source_field="__computed__",
            target_field=target_field,
            transform=None,
            default=None,
            required=False,
        )
        self._mappings.append(mapping)
        chain_key = f"computed_{target_field}"
        self._transform_chains[chain_key] = TransformChain([lambda x, f=func, d=depends_on: f(x)])
        return self

    def clear(self) -> None:
        self._mappings.clear()

    @property
    def mappings(self) -> List[FieldMapping]:
        return list(self._mappings)

    def get_target_fields(self) -> List[str]:
        return [m.target_field for m in self._mappings]
