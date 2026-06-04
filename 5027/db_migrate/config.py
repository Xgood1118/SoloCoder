import os
import yaml
from typing import Dict, Any, Optional


class Config:
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or "config.yaml"
        self._config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if not os.path.exists(self.config_path):
            return self._get_default_config()
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _get_default_config(self) -> Dict[str, Any]:
        return {
            "database": {
                "driver": "mysql",
                "host": "localhost",
                "port": 3306,
                "database": "",
                "username": "",
                "password": "",
                "charset": "utf8mb4"
            },
            "migration": {
                "script_dir": "./migrations",
                "history_table": "schema_migrations",
                "changelog_table": "data_change_log",
                "auto_validate": True
            },
            "validation": {
                "tables": [],
                "min_row_count": 0
            },
            "logging": {
                "level": "INFO",
                "file": "./logs/migration.log"
            }
        }

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split('.')
        value = self._config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    @property
    def database(self) -> Dict[str, Any]:
        return self.get("database", {})

    @property
    def migration(self) -> Dict[str, Any]:
        return self.get("migration", {})

    @property
    def validation(self) -> Dict[str, Any]:
        return self.get("validation", {})

    @property
    def logging(self) -> Dict[str, Any]:
        return self.get("logging", {})
