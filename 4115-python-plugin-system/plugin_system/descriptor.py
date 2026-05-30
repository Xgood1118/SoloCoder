import os
from pathlib import Path
from typing import Any, Dict, Optional

from .exceptions import PluginLoadError
from .models import PluginMetadata
from .utils import get_logger


logger = get_logger("descriptor")


class PluginDescriptorParser:
    SUPPORTED_FORMATS = {
        "plugin.toml": "toml",
        "plugin.yaml": "yaml",
        "plugin.yml": "yaml",
        "pyproject.toml": "toml",
    }

    @classmethod
    def parse_plugin_directory(cls, plugin_path: str) -> PluginMetadata:
        path = Path(plugin_path)
        if not path.is_dir():
            raise PluginLoadError(f"Plugin path is not a directory: {plugin_path}")

        descriptor_file = cls._find_descriptor_file(path)
        if not descriptor_file:
            raise PluginLoadError(
                f"No plugin descriptor found in {plugin_path}. "
                f"Supported files: {', '.join(cls.SUPPORTED_FORMATS.keys())}"
            )

        format_type = cls.SUPPORTED_FORMATS[descriptor_file.name]
        data = cls._parse_file(descriptor_file, format_type)

        if descriptor_file.name == "pyproject.toml":
            data = cls._extract_plugin_from_pyproject(data)

        metadata = PluginMetadata.from_dict(data, path=str(path))
        cls._validate_metadata(metadata)
        return metadata

    @classmethod
    def _find_descriptor_file(cls, path: Path) -> Optional[Path]:
        for filename in cls.SUPPORTED_FORMATS:
            file_path = path / filename
            if file_path.exists():
                return file_path
        return None

    @classmethod
    def _parse_file(cls, file_path: Path, format_type: str) -> Dict[str, Any]:
        content = file_path.read_text(encoding="utf-8")

        if format_type == "toml":
            return cls._parse_toml(content)
        elif format_type == "yaml":
            return cls._parse_yaml(content)
        else:
            raise PluginLoadError(f"Unsupported format: {format_type}")

    @staticmethod
    def _parse_toml(content: str) -> Dict[str, Any]:
        try:
            import tomllib

            return tomllib.loads(content)
        except ImportError:
            try:
                import toml

                return toml.loads(content)
            except ImportError:
                raise PluginLoadError(
                    "TOML parsing requires Python 3.11+ or the 'toml' package. "
                    "Install with: pip install toml"
                )
        except Exception as e:
            raise PluginLoadError(f"Failed to parse TOML: {e}")

    @staticmethod
    def _parse_yaml(content: str) -> Dict[str, Any]:
        try:
            import yaml

            return yaml.safe_load(content)
        except ImportError:
            raise PluginLoadError(
                "YAML parsing requires the 'pyyaml' package. "
                "Install with: pip install pyyaml"
            )
        except Exception as e:
            raise PluginLoadError(f"Failed to parse YAML: {e}")

    @staticmethod
    def _extract_plugin_from_pyproject(data: Dict[str, Any]) -> Dict[str, Any]:
        tool_data = data.get("tool", {})
        plugin_data = tool_data.get("plugin", {})

        if not plugin_data:
            raise PluginLoadError("No [tool.plugin] section found in pyproject.toml")

        project_data = data.get("project", {})
        merged = {
            "name": plugin_data.get("name") or project_data.get("name"),
            "version": plugin_data.get("version") or project_data.get("version"),
            "author": plugin_data.get("author")
            or (", ".join(a["name"] for a in project_data.get("authors", []))),
            "description": plugin_data.get("description") or project_data.get("description", ""),
            "entry_point": plugin_data.get("entry_point"),
            "dependencies": plugin_data.get("dependencies", []),
            "permissions": plugin_data.get("permissions", []),
            "api_version": plugin_data.get("api_version", "1.0.0"),
            "tags": plugin_data.get("tags", []),
            "config_schema": plugin_data.get("config_schema", {}),
        }
        return merged

    @staticmethod
    def _validate_metadata(metadata: PluginMetadata) -> None:
        required_fields = ["name", "version", "entry_point"]
        for field in required_fields:
            if not getattr(metadata, field):
                raise PluginLoadError(f"Missing required field in plugin descriptor: {field}")

        if not metadata.name.replace("_", "").isalnum():
            raise PluginLoadError(
                f"Invalid plugin name: {metadata.name}. "
                f"Name must contain only alphanumeric characters and underscores."
            )

        logger.debug(f"Validated plugin descriptor: {metadata.name} v{metadata.version}")
