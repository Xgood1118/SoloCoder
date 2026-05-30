import copy
import json
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

from .exceptions import PluginConfigError
from .utils import get_logger


logger = get_logger("config_store")


@dataclass
class ConfigSchema:
    type: str
    default: Any = None
    description: str = ""
    required: bool = False
    options: Optional[List[Any]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConfigSchema":
        return cls(
            type=data.get("type", "string"),
            default=data.get("default"),
            description=data.get("description", ""),
            required=data.get("required", False),
            options=data.get("options"),
            min_value=data.get("min_value"),
            max_value=data.get("max_value"),
        )


class ConfigLayer:
    def __init__(self, name: str, priority: int):
        self.name = name
        self.priority = priority
        self._data: Dict[str, Any] = {}

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split(".")
        value = self._data
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    def set(self, key: str, value: Any) -> None:
        keys = key.split(".")
        data = self._data
        for k in keys[:-1]:
            if k not in data or not isinstance(data[k], dict):
                data[k] = {}
            data = data[k]
        data[keys[-1]] = value

    def has(self, key: str) -> bool:
        keys = key.split(".")
        value = self._data
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        return copy.deepcopy(self._data)

    def update(self, data: Dict[str, Any]) -> None:
        self._deep_update(self._data, data)

    def _deep_update(self, target: Dict[str, Any], source: Dict[str, Any]) -> None:
        for key, value in source.items():
            if isinstance(value, dict) and key in target and isinstance(target[key], dict):
                self._deep_update(target[key], value)
            else:
                target[key] = value


class ConfigStore:
    def __init__(self, storage_path: Optional[str] = None):
        self._layers: List[ConfigLayer] = []
        self._schemas: Dict[str, ConfigSchema] = {}
        self._callbacks: Dict[str, List[Callable]] = {}
        self._storage_path = Path(storage_path) if storage_path else None
        self._lock = threading.RLock()

        self.add_layer("defaults", priority=0)
        self.add_layer("global", priority=10)
        self.add_layer("plugin", priority=20)
        self.add_layer("runtime", priority=100)

    def add_layer(self, name: str, priority: int) -> ConfigLayer:
        with self._lock:
            layer = ConfigLayer(name, priority)
            self._layers.append(layer)
            self._layers.sort(key=lambda l: l.priority)
            return layer

    def get_layer(self, name: str) -> Optional[ConfigLayer]:
        for layer in self._layers:
            if layer.name == name:
                return layer
        return None

    def set_defaults(self, config: Dict[str, Any]) -> None:
        layer = self.get_layer("defaults")
        if layer:
            layer.update(config)

    def register_schema(self, key: str, schema: Union[Dict[str, Any], ConfigSchema]) -> None:
        with self._lock:
            if isinstance(schema, dict):
                schema = ConfigSchema.from_dict(schema)
            self._schemas[key] = schema

            if schema.default is not None and not self.has(key):
                self.set(key, schema.default, layer="defaults")

    def register_schemas(self, schemas: Dict[str, Dict[str, Any]]) -> None:
        for key, schema in schemas.items():
            self.register_schema(key, schema)

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            for layer in reversed(self._layers):
                if layer.has(key):
                    return layer.get(key)
            return default

    def set(self, key: str, value: Any, layer: str = "runtime") -> None:
        with self._lock:
            config_layer = self.get_layer(layer)
            if not config_layer:
                raise PluginConfigError(f"Config layer not found: {layer}")

            if key in self._schemas:
                self._validate_value(key, value)

            old_value = self.get(key)
            config_layer.set(key, value)

            if old_value != value:
                self._notify_change(key, old_value, value)

    def has(self, key: str) -> bool:
        with self._lock:
            for layer in reversed(self._layers):
                if layer.has(key):
                    return True
            return False

    def delete(self, key: str, layer: str = "runtime") -> None:
        raise PluginConfigError("Delete operation not supported for hierarchical config")

    def update(self, config: Dict[str, Any], layer: str = "runtime") -> None:
        with self._lock:
            for key, value in self._flatten_dict(config).items():
                self.set(key, value, layer)

    def _flatten_dict(self, d: Dict[str, Any], parent_key: str = "") -> Dict[str, Any]:
        items = {}
        for key, value in d.items():
            new_key = f"{parent_key}.{key}" if parent_key else key
            if isinstance(value, dict):
                items.update(self._flatten_dict(value, new_key))
            else:
                items[new_key] = value
        return items

    def _validate_value(self, key: str, value: Any) -> None:
        schema = self._schemas.get(key)
        if not schema:
            return

        if value is None:
            if schema.required:
                raise PluginConfigError(f"Config '{key}' is required but value is None")
            return

        type_mapping = {
            "string": str,
            "integer": int,
            "number": (int, float),
            "boolean": bool,
            "array": list,
            "object": dict,
        }

        expected_type = type_mapping.get(schema.type)
        if expected_type and not isinstance(value, expected_type):
            raise PluginConfigError(
                f"Config '{key}' expected type {schema.type}, got {type(value).__name__}"
            )

        if schema.options and value not in schema.options:
            raise PluginConfigError(
                f"Config '{key}' value {value} not in options: {schema.options}"
            )

        if schema.min_value is not None and value < schema.min_value:
            raise PluginConfigError(
                f"Config '{key}' value {value} is less than min: {schema.min_value}"
            )

        if schema.max_value is not None and value > schema.max_value:
            raise PluginConfigError(
                f"Config '{key}' value {value} is greater than max: {schema.max_value}"
            )

    def subscribe(self, key: str, callback: Callable[[str, Any, Any], None]) -> None:
        with self._lock:
            if key not in self._callbacks:
                self._callbacks[key] = []
            self._callbacks[key].append(callback)

    def unsubscribe(self, key: str, callback: Callable) -> None:
        with self._lock:
            if key in self._callbacks:
                self._callbacks[key] = [c for c in self._callbacks[key] if c != callback]

    def _notify_change(self, key: str, old_value: Any, new_value: Any) -> None:
        callbacks = []
        for pattern, cbs in self._callbacks.items():
            if self._key_matches(pattern, key):
                callbacks.extend(cbs)

        for callback in callbacks:
            try:
                callback(key, old_value, new_value)
            except Exception as e:
                logger.error(f"Error in config change callback for '{key}': {e}")

    def _key_matches(self, pattern: str, key: str) -> bool:
        if pattern == key:
            return True
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            return key.startswith(prefix)
        return False

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            result: Dict[str, Any] = {}
            for layer in self._layers:
                self._deep_update(result, layer.to_dict())
            return result

    def _deep_update(self, target: Dict[str, Any], source: Dict[str, Any]) -> None:
        for key, value in source.items():
            if isinstance(value, dict) and key in target and isinstance(target[key], dict):
                self._deep_update(target[key], value)
            else:
                target[key] = value

    def save(self, path: Optional[str] = None) -> None:
        storage_path = Path(path) if path else self._storage_path
        if not storage_path:
            raise PluginConfigError("No storage path specified")

        storage_path.parent.mkdir(parents=True, exist_ok=True)
        with open(storage_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
        logger.info(f"Config saved to: {storage_path}")

    def load(self, path: Optional[str] = None, layer: str = "plugin") -> None:
        storage_path = Path(path) if path else self._storage_path
        if not storage_path or not storage_path.exists():
            logger.warning(f"Config file not found: {storage_path}")
            return

        with open(storage_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.update(data, layer=layer)
        logger.info(f"Config loaded from: {storage_path}")


class PluginConfigStore:
    def __init__(self, plugin_name: str, global_store: ConfigStore):
        self.plugin_name = plugin_name
        self.global_store = global_store
        self._prefix = f"plugins.{plugin_name}"

    def get(self, key: str, default: Any = None) -> Any:
        return self.global_store.get(f"{self._prefix}.{key}", default)

    def set(self, key: str, value: Any, layer: str = "plugin") -> None:
        self.global_store.set(f"{self._prefix}.{key}", value, layer)

    def has(self, key: str) -> bool:
        return self.global_store.has(f"{self._prefix}.{key}")

    def subscribe(self, key: str, callback: Callable[[str, Any, Any], None]) -> None:
        self.global_store.subscribe(f"{self._prefix}.{key}", callback)

    def unsubscribe(self, key: str, callback: Callable) -> None:
        self.global_store.unsubscribe(f"{self._prefix}.{key}", callback)

    def to_dict(self) -> Dict[str, Any]:
        full_config = self.global_store.to_dict()
        plugin_config = full_config.get("plugins", {}).get(self.plugin_name, {})
        return copy.deepcopy(plugin_config)
