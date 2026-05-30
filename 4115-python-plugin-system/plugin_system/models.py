import enum
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


class PluginState(enum.Enum):
    DISCOVERED = "discovered"
    LOADED = "loaded"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    UNLOADING = "unloading"


@dataclass
class PluginDependency:
    name: str
    version_range: str

    def is_satisfied_by(self, version: str) -> bool:
        return self._check_version(version, self.version_range)

    @staticmethod
    def _check_version(version: str, range_str: str) -> bool:
        if range_str == "*":
            return True

        version_parts = PluginDependency._parse_version(version)
        if not version_parts:
            return False

        conditions = [c.strip() for c in range_str.split(",")]
        for condition in conditions:
            if not PluginDependency._check_condition(version_parts, condition):
                return False
        return True

    @staticmethod
    def _parse_version(version: str) -> Optional[List[int]]:
        match = re.match(r"^(\d+)\.(\d+)\.(\d+)$", version)
        if match:
            return [int(match.group(1)), int(match.group(2)), int(match.group(3))]
        return None

    @staticmethod
    def _check_condition(version_parts: List[int], condition: str) -> bool:
        match = re.match(r"(>=|<=|>|<|==|!=)(\d+\.\d+\.\d+)", condition)
        if not match:
            return False

        op = match.group(1)
        target = PluginDependency._parse_version(match.group(2))
        if not target:
            return False

        v = tuple(version_parts)
        t = tuple(target)

        if op == ">=":
            return v >= t
        elif op == "<=":
            return v <= t
        elif op == ">":
            return v > t
        elif op == "<":
            return v < t
        elif op == "==":
            return v == t
        elif op == "!=":
            return v != t
        return False


@dataclass
class PluginMetadata:
    name: str
    version: str
    author: str
    description: str
    entry_point: str
    dependencies: List[PluginDependency] = field(default_factory=list)
    permissions: List[str] = field(default_factory=list)
    api_version: str = "1.0.0"
    tags: List[str] = field(default_factory=list)
    config_schema: Dict[str, Any] = field(default_factory=dict)
    path: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any], path: Optional[str] = None) -> "PluginMetadata":
        deps = []
        for dep_data in data.get("dependencies", []):
            if isinstance(dep_data, dict):
                deps.append(PluginDependency(**dep_data))
            elif isinstance(dep_data, str):
                name, _, version = dep_data.partition(">=")
                if version:
                    deps.append(PluginDependency(name=name.strip(), version_range=f">={version}"))
                else:
                    deps.append(PluginDependency(name=dep_data, version_range="*"))

        return cls(
            name=data["name"],
            version=data["version"],
            author=data.get("author", "unknown"),
            description=data.get("description", ""),
            entry_point=data["entry_point"],
            dependencies=deps,
            permissions=data.get("permissions", []),
            api_version=data.get("api_version", "1.0.0"),
            tags=data.get("tags", []),
            config_schema=data.get("config_schema", {}),
            path=path,
        )


@dataclass
class PluginInstance:
    metadata: PluginMetadata
    module: Any
    instance: Any
    state: PluginState = PluginState.LOADED
    config: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    def has_permission(self, permission: str) -> bool:
        return permission in self.metadata.permissions
