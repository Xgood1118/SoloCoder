"""
保留策略模块
根据配置的保留策略清理云端旧版本文件
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import os
from collections import defaultdict
from .config import BackupTask, RetentionConfig
from .cloud_storage import CloudStorageClient, CloudStorageFactory, CloudFile, CloudFileVersion
from .logger import get_logger

logger = get_logger("retention")


@dataclass
class RetentionAction:
    file_path: str
    version_id: str
    action: str
    reason: str
    size: int = 0
    upload_time: float = 0


@dataclass
class RetentionReport:
    task_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    files_checked: int = 0
    versions_checked: int = 0
    versions_deleted: int = 0
    space_freed: int = 0
    actions: List[RetentionAction] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def complete(self):
        self.end_time = datetime.now()

    def add_action(self, action: RetentionAction):
        self.actions.append(action)
        if action.action == "delete":
            self.versions_deleted += 1
            self.space_freed += action.size

    def add_error(self, error: str):
        self.errors.append(error)

    def to_summary(self) -> str:
        lines = [
            "=" * 60,
            f"保留策略执行报告 - {self.task_name}",
            "=" * 60,
            f"开始时间: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"结束时间: {self.end_time.strftime('%Y-%m-%d %H:%M:%S') if self.end_time else '未完成'}",
            "-" * 60,
            f"检查文件数: {self.files_checked}",
            f"检查版本数: {self.versions_checked}",
            f"删除版本数: {self.versions_deleted}",
            f"释放空间: {self._format_size(self.space_freed)}",
            "-" * 60,
        ]

        if self.actions:
            lines.append("执行的操作:")
            for action in self.actions[:20]:
                time_str = datetime.fromtimestamp(action.upload_time).strftime('%Y-%m-%d %H:%M')
                lines.append(
                    f"  [{action.action.upper()}] {action.file_path}@{action.version_id[:8]}... "
                    f"({self._format_size(action.size)}, {time_str}) - {action.reason}"
                )
            if len(self.actions) > 20:
                lines.append(f"  ... 还有 {len(self.actions) - 20} 个操作")
            lines.append("-" * 60)

        if self.errors:
            lines.append("错误信息:")
            for error in self.errors[:10]:
                lines.append(f"  - {error}")
            if len(self.errors) > 10:
                lines.append(f"  ... 还有 {len(self.errors) - 10} 个错误")

        return "\n".join(lines)

    @staticmethod
    def _format_size(size_bytes: int) -> str:
        if size_bytes == 0:
            return "0 B"
        import math
        units = ['B', 'KB', 'MB', 'GB', 'TB']
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {units[i]}"


class RetentionManager:
    def __init__(
        self,
        task: BackupTask,
        cloud_client: Optional[CloudStorageClient] = None
    ):
        self.task = task
        self.config: RetentionConfig = task.retention
        self.cloud_client = cloud_client or CloudStorageFactory.create(task.cloud_storage)

    def _get_directories(self, files: List[CloudFile]) -> Dict[str, List[CloudFile]]:
        if self.config.scope == "global":
            return {"__global__": files}

        directories: Dict[str, List[CloudFile]] = defaultdict(list)
        for file in files:
            dir_path = os.path.dirname(file.file_path)
            directories[dir_path].append(file)

        return directories

    def _check_references(self, file_path: str) -> bool:
        return self.cloud_client.has_other_references(file_path, self.task.name)

    def _apply_count_policy(
        self,
        files: List[CloudFile],
        max_versions: int
    ) -> List[RetentionAction]:
        actions = []
        for file in files:
            versions = sorted(file.versions, key=lambda v: v.upload_time, reverse=True)

            if len(versions) <= max_versions:
                continue

            has_other_refs = self._check_references(file.file_path)

            for version in versions[max_versions:]:
                if has_other_refs:
                    logger.debug(
                        f"跳过删除 {file.file_path}@{version.version_id[:8]}...: "
                        f"被其他任务引用"
                    )
                    continue

                actions.append(RetentionAction(
                    file_path=file.file_path,
                    version_id=version.version_id,
                    action="delete",
                    reason=f"超出版本数量限制 (当前 {len(versions)} > 最大 {max_versions})",
                    size=version.size,
                    upload_time=version.upload_time
                ))

        return actions

    def _apply_time_policy(
        self,
        files: List[CloudFile],
        retention_days: int
    ) -> List[RetentionAction]:
        actions = []
        cutoff_time = datetime.now().timestamp() - (retention_days * 24 * 3600)

        for file in files:
            versions = sorted(file.versions, key=lambda v: v.upload_time, reverse=True)

            has_other_refs = self._check_references(file.file_path)

            for i, version in enumerate(versions):
                if i == 0:
                    continue

                if version.upload_time < cutoff_time:
                    if has_other_refs:
                        logger.debug(
                            f"跳过删除 {file.file_path}@{version.version_id[:8]}...: "
                            f"被其他任务引用"
                        )
                        continue

                    age_days = (datetime.now().timestamp() - version.upload_time) / (24 * 3600)
                    actions.append(RetentionAction(
                        file_path=file.file_path,
                        version_id=version.version_id,
                        action="delete",
                        reason=f"超出保留时间 (已保存 {age_days:.1f} 天 > 最大 {retention_days} 天)",
                        size=version.size,
                        upload_time=version.upload_time
                    ))

        return actions

    def _apply_size_policy(
        self,
        files: List[CloudFile],
        max_total_size: int
    ) -> List[RetentionAction]:
        actions = []

        all_versions: List[Tuple[CloudFile, CloudFileVersion]] = []
        for file in files:
            for version in file.versions:
                all_versions.append((file, version))

        all_versions.sort(key=lambda x: x[1].upload_time)

        current_total = sum(v.size for _, v in all_versions)

        if current_total <= max_total_size:
            return actions

        space_to_free = current_total - max_total_size
        space_freed = 0

        ref_cache: Dict[str, bool] = {}

        for file, version in all_versions:
            if space_freed >= space_to_free:
                break

            if version.is_latest:
                continue

            if file.file_path not in ref_cache:
                ref_cache[file.file_path] = self._check_references(file.file_path)

            if ref_cache[file.file_path]:
                logger.debug(
                    f"跳过删除 {file.file_path}@{version.version_id[:8]}...: "
                    f"被其他任务引用"
                )
                continue

            actions.append(RetentionAction(
                file_path=file.file_path,
                version_id=version.version_id,
                action="delete",
                reason=f"超出存储总量限制 (需要释放 {self._format_size(space_to_free)})",
                size=version.size,
                upload_time=version.upload_time
            ))
            space_freed += version.size

        return actions

    def _execute_actions(self, actions: List[RetentionAction]) -> List[RetentionAction]:
        executed = []
        for action in actions:
            if action.action == "delete":
                try:
                    success = self.cloud_client.delete_file(
                        action.file_path,
                        action.version_id
                    )
                    if success:
                        logger.info(
                            f"已删除版本: {action.file_path}@{action.version_id[:8]}... "
                            f"({self._format_size(action.size)})"
                        )
                        executed.append(action)
                    else:
                        logger.warning(f"删除版本失败: {action.file_path}@{action.version_id}")
                except Exception as e:
                    logger.error(f"删除版本异常 {action.file_path}: {e}")

        return executed

    def apply_retention(self) -> RetentionReport:
        logger.info(
            f"开始执行保留策略: {self.task.name}, "
            f"范围: {self.config.scope}, "
            f"优先级: {self.config.priority}"
        )

        report = RetentionReport(
            task_name=self.task.name,
            start_time=datetime.now()
        )

        try:
            all_files = self.cloud_client.list_files(self.task.target_path)
            report.files_checked = len(all_files)

            total_versions = sum(len(f.versions) for f in all_files)
            report.versions_checked = total_versions

            logger.info(
                f"发现 {len(all_files)} 个文件, "
                f"{total_versions} 个版本"
            )

            directories = self._get_directories(all_files)

            for dir_name, files in directories.items():
                if dir_name != "__global__":
                    logger.debug(f"处理目录: {dir_name}, {len(files)} 个文件")

                dir_actions: List[RetentionAction] = []

                for policy_name in self.config.priority:
                    if policy_name == "count":
                        actions = self._apply_count_policy(
                            files,
                            self.config.max_versions
                        )
                        logger.debug(f"数量策略产生 {len(actions)} 个删除操作")
                        dir_actions.extend(actions)

                    elif policy_name == "time":
                        actions = self._apply_time_policy(
                            files,
                            self.config.retention_days
                        )
                        logger.debug(f"时间策略产生 {len(actions)} 个删除操作")
                        dir_actions.extend(actions)

                    elif policy_name == "size":
                        actions = self._apply_size_policy(
                            files,
                            self.config.max_total_size
                        )
                        logger.debug(f"容量策略产生 {len(actions)} 个删除操作")
                        dir_actions.extend(actions)

                unique_actions = self._deduplicate_actions(dir_actions)
                executed = self._execute_actions(unique_actions)

                for action in executed:
                    report.add_action(action)

        except Exception as e:
            logger.error(f"执行保留策略失败: {e}")
            report.add_error(str(e))

        report.complete()

        logger.info(
            f"保留策略执行完成: {self.task.name}, "
            f"删除 {report.versions_deleted} 个版本, "
            f"释放 {self._format_size(report.space_freed)}"
        )

        return report

    @staticmethod
    def _deduplicate_actions(actions: List[RetentionAction]) -> List[RetentionAction]:
        seen = set()
        unique = []
        for action in actions:
            key = (action.file_path, action.version_id)
            if key not in seen:
                seen.add(key)
                unique.append(action)
        return unique

    @staticmethod
    def _format_size(size_bytes: int) -> str:
        return RetentionReport._format_size(size_bytes)


class RetentionManagerFactory:
    @staticmethod
    def create(task: BackupTask) -> RetentionManager:
        return RetentionManager(task)
