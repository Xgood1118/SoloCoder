"""
差异备份模块
基于文件内容哈希实现增量备份，只上传有变化的文件
"""

from datetime import datetime
from typing import List, Optional, Tuple, Dict
import os
import time
import concurrent.futures
from .config import BackupTask
from .cloud_storage import CloudStorageClient, CloudStorageFactory
from .compression import CompressionManager
from .encryption import EncryptionManager
from .bandwidth import BandwidthLimiter
from .fingerprint import FingerprintDatabase
from .report import SyncReport, FileSyncResult
from .logger import get_logger

logger = get_logger("differential")


class DifferentialBackuper:
    def __init__(
        self,
        task: BackupTask,
        fingerprint_db: FingerprintDatabase,
        cloud_client: Optional[CloudStorageClient] = None,
        compression_manager: Optional[CompressionManager] = None,
        encryption_manager: Optional[EncryptionManager] = None,
        bandwidth_limiter: Optional[BandwidthLimiter] = None
    ):
        self.task = task
        self.fingerprint_db = fingerprint_db
        self.cloud_client = cloud_client or CloudStorageFactory.create(task.cloud_storage)
        self.compression_manager = compression_manager or CompressionManager(task.compression)
        self.encryption_manager = encryption_manager
        self.bandwidth_limiter = bandwidth_limiter or BandwidthLimiter(task.bandwidth_limit)
        self._is_running = False

    def _get_target_path(self, local_file: str) -> str:
        rel_path = os.path.relpath(local_file, self.task.source_dir)
        rel_path = rel_path.replace('\\', '/')
        target_path = self.task.target_path.rstrip('/') + '/' + rel_path
        return target_path

    def _list_local_files(self) -> List[str]:
        files = []
        if not os.path.exists(self.task.source_dir):
            logger.error(f"源目录不存在: {self.task.source_dir}")
            return files

        for root, _, filenames in os.walk(self.task.source_dir):
            for filename in filenames:
                filepath = os.path.join(root, filename)
                files.append(filepath)

        files.sort()
        return files

    def _is_file_accessible(self, file_path: str) -> Tuple[bool, str]:
        try:
            if not os.path.exists(file_path):
                return False, "文件不存在"
            if not os.path.isfile(file_path):
                return False, "不是文件"
            with open(file_path, 'rb'):
                pass
            return True, ""
        except PermissionError:
            return False, "权限不足"
        except OSError as e:
            if "used by another process" in str(e).lower() or "lock" in str(e).lower():
                return False, "文件被其他进程锁定"
            return False, f"无法访问: {e}"

    def _check_file_changed(
        self,
        local_file: str
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        changed, stored_fingerprint, new_hash = self.fingerprint_db.file_changed(
            local_file, self.task.name
        )
        return changed, new_hash, stored_fingerprint.file_hash if stored_fingerprint else None

    def _process_single_file(self, local_file: str) -> Tuple[FileSyncResult, Optional[Dict]]:
        target_path = self._get_target_path(local_file)
        start_time = time.time()

        accessible, reason = self._is_file_accessible(local_file)
        if not accessible:
            logger.warning(f"跳过不可访问的文件: {local_file} - {reason}")
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                skipped=True,
                skip_reason=reason
            ), None

        changed, new_hash, old_hash = self._check_file_changed(local_file)

        if not changed:
            logger.debug(f"文件未变化，跳过备份: {local_file}")
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                skipped=True,
                skip_reason="文件内容未变化"
            ), None

        logger.info(
            f"文件已变化，执行备份: {local_file} "
            f"(旧哈希: {old_hash[:16] if old_hash else 'None'}..., "
            f"新哈希: {new_hash[:16] if new_hash else 'None'}...)"
        )

        try:
            original_size = os.path.getsize(local_file)
            modified_time = os.path.getmtime(local_file)
        except OSError as e:
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                error_message=f"获取文件属性失败: {e}"
            ), None

        compression_result = self.compression_manager.compress_file(local_file)
        if not compression_result.success:
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                original_size=original_size,
                error_message=compression_result.error_message
            ), None

        upload_data = compression_result.compressed_data
        upload_size = compression_result.compressed_size

        if self.encryption_manager:
            upload_data.seek(0)
            encryption_result = self.encryption_manager.encrypt_data(upload_data.read())
            if not encryption_result.success:
                return FileSyncResult(
                    file_path=local_file,
                    target_path=target_path,
                    success=False,
                    original_size=original_size,
                    compressed_size=compression_result.compressed_size,
                    error_message=encryption_result.error_message
                ), None
            upload_data = encryption_result.encrypted_data
            upload_size = encryption_result.encrypted_size

        metadata = {
            "original_size": original_size,
            "compressed": compression_result.used_compression,
            "compression_level": compression_result.compression_level,
            "encrypted": self.encryption_manager is not None,
            "source_mtime": modified_time,
            "file_hash": new_hash,
            "old_hash": old_hash,
            "backup_type": "differential"
        }

        try:
            upload_data.seek(0)
            if self.bandwidth_limiter.enabled:
                limited_data = self.bandwidth_limiter.wrap_fileobj(upload_data)
                upload_result = self.cloud_client.upload_fileobj(
                    limited_data,
                    target_path,
                    upload_size,
                    metadata
                )
            else:
                upload_result = self.cloud_client.upload_fileobj(
                    upload_data,
                    target_path,
                    upload_size,
                    metadata
                )

            if not upload_result.success:
                return FileSyncResult(
                    file_path=local_file,
                    target_path=target_path,
                    success=False,
                    original_size=original_size,
                    compressed_size=compression_result.compressed_size,
                    error_message=upload_result.error_message
                ), None

            self.cloud_client.add_file_reference(target_path, self.task.name)

            upload_time = time.time() - start_time
            logger.info(
                f"差异备份完成: {local_file}, "
                f"版本: {upload_result.version_id[:8]}..., "
                f"原始: {original_size}, 上传: {upload_size}, "
                f"耗时: {upload_time:.2f}s"
            )

            fingerprint_update = {
                "file_path": local_file,
                "task_name": self.task.name,
                "file_hash": new_hash,
                "file_size": original_size,
                "modified_time": modified_time,
                "increment_version": True
            }

            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=True,
                original_size=original_size,
                compressed_size=compression_result.compressed_size,
                upload_time=upload_time
            ), fingerprint_update

        except Exception as e:
            logger.error(f"差异备份失败 {local_file}: {e}")
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                original_size=original_size,
                compressed_size=compression_result.compressed_size,
                error_message=str(e)
            ), None

    def backup(self) -> SyncReport:
        logger.info(f"开始差异备份任务: {self.task.name}")
        self._is_running = True
        self.bandwidth_limiter.reset()

        report = SyncReport(
            task_name=self.task.name,
            start_time=datetime.now()
        )

        local_files = self._list_local_files()
        logger.info(f"发现 {len(local_files)} 个本地文件")

        fingerprint_updates: List[Dict] = []
        max_workers = self.task.max_file_concurrency

        if max_workers > 1 and len(local_files) > 1:
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_file = {
                    executor.submit(self._process_single_file, file): file
                    for file in local_files
                }

                for future in concurrent.futures.as_completed(future_to_file):
                    result, update = future.result()
                    report.add_result(result)
                    if update:
                        fingerprint_updates.append(update)
        else:
            for file in local_files:
                result, update = self._process_single_file(file)
                report.add_result(result)
                if update:
                    fingerprint_updates.append(update)

        if fingerprint_updates:
            updated = self.fingerprint_db.batch_update_fingerprints(fingerprint_updates)
            logger.info(f"已更新 {updated}/{len(fingerprint_updates)} 个文件指纹")

        db_backup_path = self.fingerprint_db.backup_database()
        if db_backup_path:
            logger.info(f"指纹数据库已备份: {db_backup_path}")
            db_target_path = self.task.target_path.rstrip('/') + '/_fingerprints/' + os.path.basename(db_backup_path)
            self.cloud_client.upload_file(db_backup_path, db_target_path, {
                "type": "fingerprint_db_backup",
                "task_name": self.task.name
            })

        report.complete()
        self._is_running = False

        logger.info(
            f"差异备份任务完成: {self.task.name}, "
            f"成功: {report.files_synced}, "
            f"跳过: {report.files_skipped}, "
            f"失败: {report.files_failed}, "
            f"总上传: {report.total_data_uploaded} bytes"
        )

        return report

    def initial_full_backup(self) -> SyncReport:
        logger.info(f"执行首次全量备份: {self.task.name}")

        existing_files = self.fingerprint_db.get_task_files(self.task.name)
        if existing_files:
            logger.warning(f"检测到已有指纹记录 {len(existing_files)} 条，将覆盖")

        report = self.backup()
        return report

    def stop(self):
        self._is_running = False
        logger.info(f"差异备份任务已停止: {self.task.name}")


class DifferentialBackupFactory:
    @staticmethod
    def create(task: BackupTask, db_path: str) -> DifferentialBackuper:
        fingerprint_db = FingerprintDatabase(db_path)
        return DifferentialBackuper(task, fingerprint_db)
