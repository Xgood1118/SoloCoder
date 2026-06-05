"""
配置管理模块
负责加载、验证和提供备份系统的配置访问
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import yaml
import os


@dataclass
class CompressionStrategy:
    extensions: List[str]
    level: int


@dataclass
class CompressionConfig:
    enabled: bool = True
    default_level: int = 6
    max_file_size: int = 1024 * 1024 * 1024
    strategies: List[CompressionStrategy] = field(default_factory=list)

    def get_compression_level(self, file_extension: str) -> int:
        file_extension = file_extension.lower()
        for strategy in self.strategies:
            if file_extension in [ext.lower() for ext in strategy.extensions]:
                return strategy.level
        return self.default_level


@dataclass
class TLSConfig:
    version_preference: List[str] = field(default_factory=lambda: ["1.3", "1.2"])
    verify_cert: bool = True


@dataclass
class RetentionConfig:
    scope: str = "per_directory"
    priority: List[str] = field(default_factory=lambda: ["count", "time", "size"])
    max_versions: int = 10
    retention_days: int = 30
    max_total_size: int = 10 * 1024 * 1024 * 1024


@dataclass
class CloudStorageConfig:
    provider: str = "local"
    bucket: str = ""
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    region: Optional[str] = None
    endpoint: Optional[str] = None


@dataclass
class BackupTask:
    name: str
    source_dir: str
    target_path: str
    priority: int = 1
    schedule: str = "0 2 * * *"
    sync_mode: str = "incremental"
    max_file_concurrency: int = 5
    bandwidth_limit: float = 0
    compression: CompressionConfig = field(default_factory=CompressionConfig)
    retention: RetentionConfig = field(default_factory=RetentionConfig)
    cloud_storage: CloudStorageConfig = field(default_factory=CloudStorageConfig)

    def __post_init__(self):
        self.source_dir = os.path.abspath(self.source_dir)


@dataclass
class GlobalConfig:
    max_concurrent_tasks: int = 3
    log_level: str = "INFO"
    log_file: str = "backup.log"
    fingerprint_db_path: str = "./fingerprints.db"


@dataclass
class BackupConfig:
    global_config: GlobalConfig
    tls: TLSConfig
    tasks: List[BackupTask]

    def get_task_by_name(self, name: str) -> Optional[BackupTask]:
        for task in self.tasks:
            if task.name == name:
                return task
        return None


class ConfigLoader:
    @staticmethod
    def load(config_path: str) -> BackupConfig:
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"配置文件不存在: {config_path}")

        with open(config_path, 'r', encoding='utf-8') as f:
            raw_config = yaml.safe_load(f)

        return ConfigLoader._parse_config(raw_config)

    @staticmethod
    def _parse_config(raw: Dict[str, Any]) -> BackupConfig:
        global_raw = raw.get('global', {})
        global_config = GlobalConfig(
            max_concurrent_tasks=global_raw.get('max_concurrent_tasks', 3),
            log_level=global_raw.get('log_level', 'INFO'),
            log_file=global_raw.get('log_file', 'backup.log'),
            fingerprint_db_path=global_raw.get('fingerprint_db_path', './fingerprints.db')
        )

        tls_raw = raw.get('tls', {})
        tls_config = TLSConfig(
            version_preference=tls_raw.get('version_preference', ['1.3', '1.2']),
            verify_cert=tls_raw.get('verify_cert', True)
        )

        tasks = []
        for task_raw in raw.get('tasks', []):
            task = ConfigLoader._parse_task(task_raw)
            tasks.append(task)

        return BackupConfig(
            global_config=global_config,
            tls=tls_config,
            tasks=tasks
        )

    @staticmethod
    def _parse_task(raw: Dict[str, Any]) -> BackupTask:
        compression_raw = raw.get('compression', {})
        strategies_raw = compression_raw.get('strategies', [])
        strategies = [
            CompressionStrategy(
                extensions=s.get('extensions', []),
                level=s.get('level', 6)
            ) for s in strategies_raw
        ]
        compression = CompressionConfig(
            enabled=compression_raw.get('enabled', True),
            default_level=compression_raw.get('default_level', 6),
            max_file_size=compression_raw.get('max_file_size', 1024 * 1024 * 1024),
            strategies=strategies
        )

        retention_raw = raw.get('retention', {})
        retention = RetentionConfig(
            scope=retention_raw.get('scope', 'per_directory'),
            priority=retention_raw.get('priority', ['count', 'time', 'size']),
            max_versions=retention_raw.get('max_versions', 10),
            retention_days=retention_raw.get('retention_days', 30),
            max_total_size=retention_raw.get('max_total_size', 10 * 1024 * 1024 * 1024)
        )

        cloud_raw = raw.get('cloud_storage', {})
        cloud_storage = CloudStorageConfig(
            provider=cloud_raw.get('provider', 'local'),
            bucket=cloud_raw.get('bucket', ''),
            access_key=cloud_raw.get('access_key'),
            secret_key=cloud_raw.get('secret_key'),
            region=cloud_raw.get('region'),
            endpoint=cloud_raw.get('endpoint')
        )

        return BackupTask(
            name=raw.get('name', 'unnamed_task'),
            source_dir=raw.get('source_dir', ''),
            target_path=raw.get('target_path', '/'),
            priority=raw.get('priority', 1),
            schedule=raw.get('schedule', '0 2 * * *'),
            sync_mode=raw.get('sync_mode', 'incremental'),
            max_file_concurrency=raw.get('max_file_concurrency', 5),
            bandwidth_limit=raw.get('bandwidth_limit', 0),
            compression=compression,
            retention=retention,
            cloud_storage=cloud_storage
        )

    @staticmethod
    def validate(config: BackupConfig) -> List[str]:
        errors = []

        if config.global_config.max_concurrent_tasks < 1:
            errors.append("全局最大并发任务数必须大于等于1")

        for task in config.tasks:
            if not task.name:
                errors.append("任务名称不能为空")
            if not os.path.exists(task.source_dir):
                errors.append(f"任务 {task.name} 的源目录不存在: {task.source_dir}")
            if task.compression.default_level < 1 or task.compression.default_level > 9:
                errors.append(f"任务 {task.name} 的默认压缩级别必须在1-9之间")
            for strategy in task.compression.strategies:
                if strategy.level < 0 or strategy.level > 9:
                    errors.append(f"任务 {task.name} 的压缩策略级别必须在0-9之间")
            if task.bandwidth_limit < 0:
                errors.append(f"任务 {task.name} 的带宽限制不能为负数")
            if task.max_file_concurrency < 1:
                errors.append(f"任务 {task.name} 的文件并发数必须大于等于1")
            if task.priority < 1 or task.priority > 10:
                errors.append(f"任务 {task.name} 的优先级必须在1-10之间")

        return errors
