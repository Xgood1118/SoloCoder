"""
压缩策略模块
根据文件类型和大小智能选择压缩策略
"""

from dataclasses import dataclass
from typing import Optional, Tuple
import io
import os
import gzip
import zlib
from .config import CompressionConfig
from .logger import get_logger

logger = get_logger("compression")


@dataclass
class CompressionResult:
    success: bool
    compressed_data: Optional[io.BytesIO]
    original_size: int
    compressed_size: int
    compression_level: int
    used_compression: bool
    error_message: str = ""


class CompressionManager:
    def __init__(self, config: CompressionConfig):
        self.config = config

    def should_compress(self, file_path: str, file_size: int) -> Tuple[bool, int]:
        if not self.config.enabled:
            return False, 0

        if file_size > self.config.max_file_size:
            logger.debug(f"文件过大，跳过压缩: {file_path} ({file_size} bytes)")
            return False, 0

        _, ext = os.path.splitext(file_path)
        level = self.config.get_compression_level(ext)

        if level <= 0:
            logger.debug(f"文件类型配置为不压缩: {file_path} (level={level})")
            return False, 0

        return True, level

    def compress_file(self, file_path: str) -> CompressionResult:
        try:
            if not os.path.exists(file_path) or not os.path.isfile(file_path):
                return CompressionResult(
                    success=False,
                    compressed_data=None,
                    original_size=0,
                    compressed_size=0,
                    compression_level=0,
                    used_compression=False,
                    error_message=f"文件不存在: {file_path}"
                )

            file_size = os.path.getsize(file_path)
            should_zip, level = self.should_compress(file_path, file_size)

            if not should_zip:
                with open(file_path, 'rb') as f:
                    data = io.BytesIO(f.read())
                return CompressionResult(
                    success=True,
                    compressed_data=data,
                    original_size=file_size,
                    compressed_size=file_size,
                    compression_level=0,
                    used_compression=False
                )

            return self._compress_with_gzip(file_path, file_size, level)

        except PermissionError:
            return CompressionResult(
                success=False,
                compressed_data=None,
                original_size=0,
                compressed_size=0,
                compression_level=0,
                used_compression=False,
                error_message=f"无法读取文件（权限不足）: {file_path}"
            )
        except OSError as e:
            logger.warning(f"压缩文件失败，回退为原文件: {file_path}, 错误: {e}")
            return self._fallback_to_original(file_path)

    def _compress_with_gzip(
        self,
        file_path: str,
        file_size: int,
        level: int
    ) -> CompressionResult:
        try:
            output = io.BytesIO()

            with open(file_path, 'rb') as f_in:
                with gzip.GzipFile(fileobj=output, mode='wb', compresslevel=level) as f_out:
                    chunk_size = 8192
                    while True:
                        chunk = f_in.read(chunk_size)
                        if not chunk:
                            break
                        f_out.write(chunk)

            compressed_size = output.tell()
            output.seek(0)

            if compressed_size >= file_size:
                logger.debug(f"压缩后体积更大，使用原文件: {file_path} ({file_size} -> {compressed_size})")
                with open(file_path, 'rb') as f:
                    data = io.BytesIO(f.read())
                return CompressionResult(
                    success=True,
                    compressed_data=data,
                    original_size=file_size,
                    compressed_size=file_size,
                    compression_level=0,
                    used_compression=False
                )

            logger.debug(
                f"文件压缩完成: {file_path}, "
                f"原始: {file_size}, 压缩后: {compressed_size}, "
                f"比率: {compressed_size/file_size:.2%}, 级别: {level}"
            )

            return CompressionResult(
                success=True,
                compressed_data=output,
                original_size=file_size,
                compressed_size=compressed_size,
                compression_level=level,
                used_compression=True
            )

        except (gzip.BadGzipFile, zlib.error, OSError) as e:
            logger.warning(f"gzip压缩失败，回退为原文件: {file_path}, 错误: {e}")
            return self._fallback_to_original(file_path)

    def _fallback_to_original(self, file_path: str) -> CompressionResult:
        try:
            file_size = os.path.getsize(file_path)
            with open(file_path, 'rb') as f:
                data = io.BytesIO(f.read())
            return CompressionResult(
                success=True,
                compressed_data=data,
                original_size=file_size,
                compressed_size=file_size,
                compression_level=0,
                used_compression=False
            )
        except IOError as e:
            return CompressionResult(
                success=False,
                compressed_data=None,
                original_size=0,
                compressed_size=0,
                compression_level=0,
                used_compression=False,
                error_message=f"读取文件失败: {e}"
            )

    def compress_data(self, data: bytes, file_extension: str = "") -> CompressionResult:
        data_size = len(data)

        if not self.config.enabled:
            return CompressionResult(
                success=True,
                compressed_data=io.BytesIO(data),
                original_size=data_size,
                compressed_size=data_size,
                compression_level=0,
                used_compression=False
            )

        if data_size > self.config.max_file_size:
            return CompressionResult(
                success=True,
                compressed_data=io.BytesIO(data),
                original_size=data_size,
                compressed_size=data_size,
                compression_level=0,
                used_compression=False
            )

        level = self.config.get_compression_level(file_extension)

        if level <= 0:
            return CompressionResult(
                success=True,
                compressed_data=io.BytesIO(data),
                original_size=data_size,
                compressed_size=data_size,
                compression_level=0,
                used_compression=False
            )

        try:
            output = io.BytesIO()
            with gzip.GzipFile(fileobj=output, mode='wb', compresslevel=level) as f:
                f.write(data)

            compressed_size = output.tell()
            output.seek(0)

            if compressed_size >= data_size:
                return CompressionResult(
                    success=True,
                    compressed_data=io.BytesIO(data),
                    original_size=data_size,
                    compressed_size=data_size,
                    compression_level=0,
                    used_compression=False
                )

            return CompressionResult(
                success=True,
                compressed_data=output,
                original_size=data_size,
                compressed_size=compressed_size,
                compression_level=level,
                used_compression=True
            )

        except (gzip.BadGzipFile, zlib.error) as e:
            logger.warning(f"数据压缩失败，使用原始数据: {e}")
            return CompressionResult(
                success=True,
                compressed_data=io.BytesIO(data),
                original_size=data_size,
                compressed_size=data_size,
                compression_level=0,
                used_compression=False
            )

    @staticmethod
    def decompress_data(compressed_data: bytes) -> bytes:
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(compressed_data), mode='rb') as f:
                return f.read()
        except gzip.BadGzipFile:
            return compressed_data
