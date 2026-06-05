"""
目录同步模块
实现本地目录到云存储的同步功能，支持全量和增量同步
"""

from datetime import datetime
from typing import List, Optional, Tuple
import os
import time
import concurrent.futures
from .config import BackupTask
from .cloud_storage import CloudStorageClient, CloudStorageFactory
from .compression import CompressionManager
from .encryption import EncryptionManager
from .bandwidth import BandwidthLimiter
from .report import SyncReport, FileSyncResult
from .logger import get_logger

logger = get_logger("sync")


class DirectorySynchronizer:
    def __init__(
        self,
        task: BackupTask,
        cloud_client: Optional[CloudStorageClient] = None,
        compression_manager: Optional[CompressionManager] = None,
        encryption_manager: Optional[EncryptionManager] = None,
        bandwidth_limiter: Optional[BandwidthLimiter] = None
    ):
        self.task = task
        self.cloud_client = cloud_client or CloudStorageFactory.create(task.cloud_storage)
        self.compression_manager = compression_manager or CompressionManager(task.compression)
        self.encryption_manager = encryption_manager
        self.bandwidth_limiter = bandwidth_limiter or BandwidthLimiter(task.bandwidth_limit)
        self._is_running = False

    def is_file_locked(self, file_path: str) -> bool:
        try:
            with open(file_path, 'rb'):
                return False
        except PermissionError:
            return True
        except OSError as e:
            if "used by another process" in str(e).lower() or "lock" in str(e).lower():
                return True
            return False

    def should_sync_file(
        self,
        local_file: str,
        target_path: str
    ) -> Tuple[bool, str]:
        if self.task.sync_mode == "full":
            return True, "全量同步"

        try:
            local_mtime = os.path.getmtime(local_file)
        except OSError as e:
            return False, f"无法获取本地文件时间: {e}"

        cloud_mtime = self.cloud_client.get_modified_time(target_path)

        if cloud_mtime is None:
            return True, "云端不存在"

        if abs(local_mtime - cloud_mtime) > 0.001:
            return True, f"文件已修改 (本地: {datetime.fromtimestamp(local_mtime)}, 云端: {datetime.fromtimestamp(cloud_mtime)})"

        return False, "文件未修改"

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

    def _process_single_file(self, local_file: str) -> FileSyncResult:
        target_path = self._get_target_path(local_file)
        start_time = time.time()

        if self.is_file_locked(local_file):
            logger.warning(f"文件被锁定，跳过: {local_file}")
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                skipped=True,
                skip_reason="文件被其他进程锁定"
            )

        should_sync, reason = self.should_sync_file(local_file, target_path)
        if not should_sync:
            logger.debug(f"跳过未修改的文件: {local_file} ({reason})")
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                skipped=True,
                skip_reason=reason
            )

        logger.info(f"同步文件: {local_file} -> {target_path} ({reason})")

        try:
            original_size = os.path.getsize(local_file)
        except OSError as e:
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                error_message=f"获取文件大小失败: {e}"
            )

        compression_result = self.compression_manager.compress_file(local_file)
        if not compression_result.success:
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                original_size=original_size,
                error_message=compression_result.error_message
            )

        upload_data = compression_result.compressed_data
        compressed_size = compression_result.compressed_size

        if self.encryption_manager:
            upload_data.seek(0)
            encryption_result = self.encryption_manager.encrypt_data(upload_data.read())
            if not encryption_result.success:
                return FileSyncResult(
                    file_path=local_file,
                    target_path=target_path,
                    success=False,
                    original_size=original_size,
                    compressed_size=compressed_size,
                    error_message=encryption_result.error_message
                )
            upload_data = encryption_result.encrypted_data
            compressed_size = encryption_result.encrypted_size

        metadata = {
            "original_size": original_size,
            "compressed": compression_result.used_compression,
            "compression_level": compression_result.compression_level,
            "encrypted": self.encryption_manager is not None,
            "source_mtime": os.path.getmtime(local_file)
        }

        try:
            upload_data.seek(0)
            if self.bandwidth_limiter.enabled:
                limited_data = self.bandwidth_limiter.wrap_fileobj(upload_data)
                upload_result = self.cloud_client.upload_fileobj(
                    limited_data,
                    target_path,
                    compressed_size,
                    metadata
                )
            else:
                upload_result = self.cloud_client.upload_fileobj(
                    upload_data,
                    target_path,
                    compressed_size,
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
                )

            self.cloud_client.add_file_reference(target_path, self.task.name)

            upload_time = time.time() - start_time
            logger.info(
                f"文件同步完成: {local_file}, "
                f"原始: {original_size}, 上传: {compressed_size}, "
                f"耗时: {upload_time:.2f}s"
            )

            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=True,
                original_size=original_size,
                compressed_size=compression_result.compressed_size,
                upload_time=upload_time
            )

        except Exception as e:
            logger.error(f"上传文件失败 {local_file}: {e}")
            return FileSyncResult(
                file_path=local_file,
                target_path=target_path,
                success=False,
                original_size=original_size,
                compressed_size=compression_result.compressed_size,
                error_message=str(e)
            )

    def sync(self) -> SyncReport:
        logger.info(f"开始同步任务: {self.task.name}")
        self._is_running = True
        self.bandwidth_limiter.reset()

        report = SyncReport(
            task_name=self.task.name,
            start_time=datetime.now()
        )

        local_files = self._list_local_files()
        logger.info(f"发现 {len(local_files)} 个本地文件")

        max_workers = self.task.max_file_concurrency

        if max_workers > 1 and len(local_files) > 1:
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_file = {
                    executor.submit(self._process_single_file, file): file
                    for file in local_files
                }

                for future in concurrent.futures.as_completed(future_to_file):
                    result = future.result()
                    report.add_result(result)
        else:
            for file in local_files:
                result = self._process_single_file(file)
                report.add_result(result)

        report.complete()
        self._is_running = False

        logger.info(
            f"同步任务完成: {self.task.name}, "
            f"成功: {report.files_synced}, "
            f"跳过: {report.files_skipped}, "
            f"失败: {report.files_failed}, "
            f"总上传: {report.total_data_uploaded} bytes"
        )

        return report

    def stop(self):
        self._is_running = False
        logger.info(f"同步任务已停止: {self.task.name}")


class SynchronizerFactory:
    @staticmethod
    def create(task: BackupTask) -> DirectorySynchronizer:
        return DirectorySynchronizer(task)
