"""Tests for the configuration system."""

import pytest

from buildforge.config import Config, ConfigLoader


class TestConfig:
    """Test Config class functionality."""

    def test_get_default_value(self):
        """Test getting default values."""
        config = Config(defaults={"timeout": 300, "build_dir": "build"})
        assert config.get("timeout") == 300
        assert config.get("build_dir") == "build"

    def test_get_missing_value(self):
        """Test getting missing values returns default."""
        config = Config()
        assert config.get("missing") is None
        assert config.get("missing", "fallback") == "fallback"

    def test_environment_override(self):
        """Test environment-specific configuration overrides defaults."""
        config = Config(defaults={"log_level": "info"}, environment="prod")
        config.set_env_config("prod", {"log_level": "warn", "optimize": True})
        config.set_env_config("dev", {"log_level": "debug"})

        assert config.get("log_level") == "warn"
        assert config.get("optimize") is True

    def test_cli_override_highest_priority(self):
        """Test CLI overrides have highest priority."""
        config = Config(defaults={"log_level": "info"}, environment="prod")
        config.set_env_config("prod", {"log_level": "warn"})
        config.set_overrides({"log_level": "trace"})

        assert config.get("log_level") == "trace"

    def test_parent_inheritance(self):
        """Test configuration inheritance from parent."""
        parent = Config(defaults={"build_dir": "build", "timeout": 300})
        child = Config(defaults={"build_dir": "custom_build"}, parent=parent)

        assert child.get("build_dir") == "custom_build"
        assert child.get("timeout") == 300

    def test_get_all_merged(self):
        """Test get_all returns fully merged configuration."""
        config = Config(defaults={"a": 1, "b": 2}, environment="prod")
        config.set_env_config("prod", {"b": 3, "c": 4})
        config.set_overrides({"c": 5})

        result = config.get_all()
        assert result == {"a": 1, "b": 3, "c": 5}

    def test_deep_merge(self):
        """Test deep merge of nested dictionaries."""
        config = Config(
            defaults={
                "database": {"host": "localhost", "port": 5432},
                "cache": {"enabled": True},
            },
            environment="prod",
        )
        config.set_env_config(
            "prod", {"database": {"port": 5433, "password": "secret"}}
        )

        merged = config.get_all()
        assert merged["database"]["host"] == "localhost"
        assert merged["database"]["port"] == 5433
        assert merged["database"]["password"] == "secret"
        assert merged["cache"]["enabled"] is True

    def test_inherit_creates_child_with_override(self):
        """Test inherit method creates child with additional overrides."""
        parent = Config(defaults={"a": 1, "b": 2}, environment="prod")
        parent.set_env_config("prod", {"c": 3})
        parent.set_overrides({"d": 4})

        child = parent.inherit({"b": 20, "e": 5})

        assert child.get("a") == 1
        assert child.get("b") == 20
        assert child.get("c") == 3
        assert child.get("d") == 4
        assert child.get("e") == 5


class TestConfigLoader:
    """Test ConfigLoader class functionality."""

    def test_build_root_config(self, sample_pipeline_data):
        """Test building root config from pipeline data."""
        config = ConfigLoader.build_root_config(sample_pipeline_data, environment="dev")

        assert config.get("build_dir") == "build"
        assert config.get("output_dir") == "dist"
        assert config.get("log_level") == "debug"
        assert config.get("optimize") is False

    def test_build_root_config_prod_env(self, sample_pipeline_data):
        """Test building config with prod environment."""
        config = ConfigLoader.build_root_config(sample_pipeline_data, environment="prod")

        assert config.get("log_level") == "warn"
        assert config.get("optimize") is True
        assert config.get("timeout") == 600

    def test_build_root_config_with_cli_overrides(self, sample_pipeline_data):
        """Test building config with CLI overrides."""
        config = ConfigLoader.build_root_config(
            sample_pipeline_data,
            environment="dev",
            cli_overrides={"log_level": "trace", "custom": "value"},
        )

        assert config.get("log_level") == "trace"
        assert config.get("custom") == "value"

    def test_build_pipeline_config(self, sample_pipeline_data):
        """Test building sub-pipeline configuration."""
        root_config = ConfigLoader.build_root_config(sample_pipeline_data, environment="dev")

        pipeline_def = {
            "config": {
                "build_dir": "pipeline_build",
                "test_type": "unit",
            }
        }

        pipeline_config = ConfigLoader.build_pipeline_config(
            root_config, pipeline_def, environment="dev"
        )

        assert pipeline_config.get("build_dir") == "pipeline_build"
        assert pipeline_config.get("test_type") == "unit"
        assert pipeline_config.get("output_dir") == "dist"
        assert pipeline_config.get("log_level") == "debug"
