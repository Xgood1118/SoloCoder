"""Configuration system with inheritance, overriding, and environment priority."""

from __future__ import annotations

import os
from typing import Any, Dict, Optional


class Config:
    """Configuration with inheritance and override support.
    
    Configuration priority (highest to lowest):
    1. Command-line overrides
    2. Environment-specific config (dev/test/prod)
    3. Sub-pipeline config
    4. Parent pipeline defaults
    5. Global defaults
    """

    def __init__(
        self,
        defaults: Optional[Dict[str, Any]] = None,
        environment: str = "dev",
        parent: Optional["Config"] = None,
    ) -> None:
        self._defaults: Dict[str, Any] = defaults or {}
        self._environment: str = environment
        self._parent: Optional[Config] = parent
        self._overrides: Dict[str, Any] = {}
        self._env_configs: Dict[str, Dict[str, Any]] = {}
        self._resolved_cache: Dict[str, Any] = {}

    def set_env_config(self, env: str, config: Dict[str, Any]) -> None:
        """Set environment-specific configuration."""
        self._env_configs[env] = config
        self._resolved_cache.clear()

    def set_overrides(self, overrides: Dict[str, Any]) -> None:
        """Set command-line or runtime overrides (highest priority)."""
        self._overrides = overrides
        self._resolved_cache.clear()

    def get(self, key: str, default: Any = None) -> Any:
        """Get a configuration value by key with full priority resolution."""
        if key in self._overrides:
            return self._overrides[key]

        env_config = self._env_configs.get(self._environment, {})
        if key in env_config:
            return env_config[key]

        if key in self._defaults:
            return self._defaults[key]

        if self._parent is not None:
            return self._parent.get(key, default)

        return default

    def get_all(self) -> Dict[str, Any]:
        """Get fully resolved configuration as a dictionary."""
        if self._resolved_cache:
            return dict(self._resolved_cache)

        result: Dict[str, Any] = {}

        if self._parent is not None:
            result = self._deep_merge(result, self._parent.get_all())

        result = self._deep_merge(result, self._defaults)
        result = self._deep_merge(result, self._env_configs.get(self._environment, {}))
        result = self._deep_merge(result, self._overrides)

        self._resolved_cache = result
        return dict(result)

    def inherit(self, config_override: Dict[str, Any]) -> "Config":
        """Create a child config that inherits from this one with additional overrides."""
        child = Config(
            defaults=self._deep_merge(self._defaults, config_override),
            environment=self._environment,
            parent=self._parent,
        )
        for env, cfg in self._env_configs.items():
            child.set_env_config(env, dict(cfg))
        child.set_overrides(dict(self._overrides))
        return child

    @staticmethod
    def _deep_merge(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge two dictionaries, with b overriding a."""
        result = dict(a)
        for key, value in b.items():
            if (
                key in result
                and isinstance(result[key], dict)
                and isinstance(value, dict)
            ):
                result[key] = Config._deep_merge(result[key], value)
            else:
                result[key] = value
        return result


class ConfigLoader:
    """Load and merge configurations from pipeline definitions."""

    @staticmethod
    def build_root_config(
        pipeline_data: Dict[str, Any],
        environment: str = "dev",
        cli_overrides: Optional[Dict[str, Any]] = None,
    ) -> Config:
        """Build the root configuration from pipeline data."""
        defaults = pipeline_data.get("defaults", {})
        config = Config(defaults=defaults, environment=environment)

        environments = pipeline_data.get("environments", {})
        for env, env_config in environments.items():
            config.set_env_config(env, env_config)

        if cli_overrides:
            config.set_overrides(cli_overrides)

        return config

    @staticmethod
    def build_pipeline_config(
        parent_config: Config,
        pipeline_def: Dict[str, Any],
        environment: str = "dev",
    ) -> Config:
        """Build a sub-pipeline configuration that inherits from parent."""
        pipeline_config_data = pipeline_def.get("config", {})
        return parent_config.inherit(pipeline_config_data)
