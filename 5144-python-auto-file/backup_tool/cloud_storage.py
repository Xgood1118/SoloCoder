"""
云存储客户端模块
提供云存储的抽象接口和本地模拟实现
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Tuple, BinaryIO
import os
import json
import shutil
import uuid
from .config import CloudStorageConfig
from .logger import get_logger

logger = get_logger("cloud_storage")


@dataclass
class CloudFileVersion:
    version_id: str
    file_path: str
    size: int
    upload_time: float
    is_latest: bool = False
    metadata: Dict = field(default_factory=dict)


@dataclass
class CloudFile:
    file_path: str
    size: int
    modified_time: float
    upload_time: float
    versions: List[CloudFileVersion] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)

    @property
    def latest_version(self) -> Optional[CloudFileVersion]:
        for v in self.versions:
            if v.is_latest:
                return v
        if self.versions:
            return self.versions[-1]
        return None


@dataclass
class UploadResult:
    success: bool
    file_path: str
    version_id: str
    size: int
    error_message: str = ""


class CloudStorageClient(ABC):
    @abstractmethod
    def upload_file(
        self,
        source_path: str,
        target_path: str,
        metadata: Optional[Dict] = None
    ) -> UploadResult:
        pass

    @abstractmethod
    def upload_fileobj(
        self,
        fileobj: BinaryIO,
        target_path: str,
        size: int,
        metadata: Optional[Dict] = None
    ) -> UploadResult:
        pass

    @abstractmethod
    def download_file(self, target_path: str, dest_path: str, version_id: Optional[str] = None) -> bool:
        pass

    @abstractmethod
    def delete_file(self, target_path: str, version_id: Optional[str] = None) -> bool:
        pass

    @abstractmethod
    def list_files(self, prefix: str = "") -> List[CloudFile]:
        pass

    @abstractmethod
    def get_file_info(self, target_path: str) -> Optional[CloudFile]:
        pass

    @abstractmethod
    def get_file_versions(self, target_path: str) -> List[CloudFileVersion]:
        pass

    @abstractmethod
    def get_modified_time(self, target_path: str) -> Optional[float]:
        pass

    def add_file_reference(self, target_path: str, task_name: str) -> int:
        return 0

    def remove_file_reference(self, target_path: str, task_name: str) -> int:
        return 0

    def get_file_references(self, target_path: str) -> List[str]:
        return []

    def has_other_references(self, target_path: str, exclude_task: str) -> bool:
        refs = self.get_file_references(target_path)
        return len([r for r in refs if r != exclude_task]) > 0


class LocalCloudStorageClient(CloudStorageClient):
    def __init__(self, config: CloudStorageConfig):
        self.bucket = os.path.abspath(config.bucket)
        self.data_dir = os.path.join(self.bucket, "data")
        self.metadata_dir = os.path.join(self.bucket, "metadata")
        self.version_dir = os.path.join(self.bucket, "versions")
        self.refs_file = os.path.join(self.bucket, "references.json")

        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.metadata_dir, exist_ok=True)
        os.makedirs(self.version_dir, exist_ok=True)

        self._references: Dict[str, List[str]] = self._load_references()
        logger.info(f"本地云存储已初始化，根目录: {self.bucket}")

    def _load_references(self) -> Dict[str, List[str]]:
        if os.path.exists(self.refs_file):
            try:
                with open(self.refs_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"加载引用关系失败: {e}")
        return {}

    def _save_references(self):
        try:
            with open(self.refs_file, 'w', encoding='utf-8') as f:
                json.dump(self._references, f, indent=2, ensure_ascii=False)
        except IOError as e:
            logger.warning(f"保存引用关系失败: {e}")

    def add_file_reference(self, target_path: str, task_name: str) -> int:
        norm_path = self._normalize_path(target_path)
        if norm_path not in self._references:
            self._references[norm_path] = []
        if task_name not in self._references[norm_path]:
            self._references[norm_path].append(task_name)
            self._save_references()
        return len(self._references[norm_path])

    def remove_file_reference(self, target_path: str, task_name: str) -> int:
        norm_path = self._normalize_path(target_path)
        if norm_path in self._references and task_name in self._references[norm_path]:
            self._references[norm_path].remove(task_name)
            if not self._references[norm_path]:
                del self._references[norm_path]
            self._save_references()
        return len(self._references.get(norm_path, []))

    def get_file_references(self, target_path: str) -> List[str]:
        norm_path = self._normalize_path(target_path)
        return list(self._references.get(norm_path, []))

    @staticmethod
    def _normalize_path(path: str) -> str:
        path = path.replace('\\', '/')
        if not path.startswith('/'):
            path = '/' + path
        return path

    def _get_data_path(self, target_path: str) -> str:
        norm_path = self._normalize_path(target_path)
        return os.path.join(self.data_dir, norm_path.lstrip('/'))

    def _get_metadata_path(self, target_path: str) -> str:
        norm_path = self._normalize_path(target_path)
        return os.path.join(self.metadata_dir, norm_path.lstrip('/') + ".json")

    def _get_version_dir(self, target_path: str) -> str:
        norm_path = self._normalize_path(target_path)
        return os.path.join(self.version_dir, norm_path.lstrip('/'))

    def _load_metadata(self, target_path: str) -> Optional[Dict]:
        meta_path = self._get_metadata_path(target_path)
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"加载元数据失败 {target_path}: {e}")
        return None

    def _save_metadata(self, target_path: str, metadata: Dict):
        meta_path = self._get_metadata_path(target_path)
        os.makedirs(os.path.dirname(meta_path), exist_ok=True)
        try:
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
        except IOError as e:
            logger.warning(f"保存元数据失败 {target_path}: {e}")

    def upload_file(
        self,
        source_path: str,
        target_path: str,
        metadata: Optional[Dict] = None
    ) -> UploadResult:
        if not os.path.exists(source_path):
            return UploadResult(False, target_path, "", 0, f"源文件不存在: {source_path}")

        try:
            file_size = os.path.getsize(source_path)
            with open(source_path, 'rb') as f:
                return self.upload_fileobj(f, target_path, file_size, metadata)
        except IOError as e:
            return UploadResult(False, target_path, "", 0, f"读取源文件失败: {e}")

    def upload_fileobj(
        self,
        fileobj: BinaryIO,
        target_path: str,
        size: int,
        metadata: Optional[Dict] = None
    ) -> UploadResult:
        try:
            norm_path = self._normalize_path(target_path)
            data_path = self._get_data_path(target_path)
            version_id = str(uuid.uuid4())
            upload_time = datetime.now().timestamp()

            os.makedirs(os.path.dirname(data_path), exist_ok=True)

            fileobj.seek(0)
            with open(data_path, 'wb') as f:
                shutil.copyfileobj(fileobj, f)

            version_dir = self._get_version_dir(target_path)
            os.makedirs(version_dir, exist_ok=True)
            version_path = os.path.join(version_dir, version_id)
            fileobj.seek(0)
            with open(version_path, 'wb') as f:
                shutil.copyfileobj(fileobj, f)

            meta = self._load_metadata(target_path) or {
                "file_path": norm_path,
                "versions": [],
                "modified_time": upload_time
            }

            new_version = {
                "version_id": version_id,
                "size": size,
                "upload_time": upload_time,
                "is_latest": True,
                "metadata": metadata or {}
            }

            for v in meta["versions"]:
                v["is_latest"] = False

            meta["versions"].append(new_version)
            meta["size"] = size
            if metadata and "source_mtime" in metadata:
                meta["modified_time"] = metadata["source_mtime"]
            else:
                meta["modified_time"] = upload_time
            meta["upload_time"] = upload_time

            self._save_metadata(target_path, meta)

            logger.debug(f"文件已上传: {norm_path} (版本: {version_id}, 大小: {size})")
            return UploadResult(True, norm_path, version_id, size)

        except IOError as e:
            return UploadResult(False, target_path, "", 0, f"上传失败: {e}")

    def download_file(self, target_path: str, dest_path: str, version_id: Optional[str] = None) -> bool:
        try:
            if version_id:
                version_path = os.path.join(self._get_version_dir(target_path), version_id)
                if not os.path.exists(version_path):
                    logger.warning(f"版本不存在: {target_path}@{version_id}")
                    return False
                source_path = version_path
            else:
                source_path = self._get_data_path(target_path)
                if not os.path.exists(source_path):
                    return False

            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            shutil.copy2(source_path, dest_path)
            return True
        except IOError as e:
            logger.error(f"下载失败 {target_path}: {e}")
            return False

    def delete_file(self, target_path: str, version_id: Optional[str] = None) -> bool:
        try:
            if version_id:
                meta = self._load_metadata(target_path)
                if not meta:
                    return False

                meta["versions"] = [v for v in meta["versions"] if v["version_id"] != version_id]

                version_path = os.path.join(self._get_version_dir(target_path), version_id)
                if os.path.exists(version_path):
                    os.remove(version_path)

                if not meta["versions"]:
                    data_path = self._get_data_path(target_path)
                    if os.path.exists(data_path):
                        os.remove(data_path)
                    meta_path = self._get_metadata_path(target_path)
                    if os.path.exists(meta_path):
                        os.remove(meta_path)
                    norm_path = self._normalize_path(target_path)
                    if norm_path in self._references:
                        del self._references[norm_path]
                        self._save_references()
                else:
                    if not any(v["is_latest"] for v in meta["versions"]):
                        meta["versions"][-1]["is_latest"] = True
                    self._save_metadata(target_path, meta)

                logger.debug(f"版本已删除: {target_path}@{version_id}")
            else:
                data_path = self._get_data_path(target_path)
                if os.path.exists(data_path):
                    os.remove(data_path)

                version_dir = self._get_version_dir(target_path)
                if os.path.exists(version_dir):
                    shutil.rmtree(version_dir)

                meta_path = self._get_metadata_path(target_path)
                if os.path.exists(meta_path):
                    os.remove(meta_path)

                norm_path = self._normalize_path(target_path)
                if norm_path in self._references:
                    del self._references[norm_path]
                    self._save_references()

                logger.debug(f"文件已删除: {target_path}")

            return True
        except IOError as e:
            logger.error(f"删除失败 {target_path}: {e}")
            return False

    def list_files(self, prefix: str = "") -> List[CloudFile]:
        files = []
        norm_prefix = self._normalize_path(prefix) if prefix else ""

        for root, _, filenames in os.walk(self.data_dir):
            for filename in filenames:
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, self.data_dir)
                target_path = '/' + rel_path.replace('\\', '/')

                if norm_prefix and not target_path.startswith(norm_prefix):
                    continue

                file_info = self.get_file_info(target_path)
                if file_info:
                    files.append(file_info)

        files.sort(key=lambda f: f.file_path)
        return files

    def get_file_info(self, target_path: str) -> Optional[CloudFile]:
        meta = self._load_metadata(target_path)
        if not meta:
            return None

        versions = [
            CloudFileVersion(
                version_id=v["version_id"],
                file_path=target_path,
                size=v["size"],
                upload_time=v["upload_time"],
                is_latest=v.get("is_latest", False),
                metadata=v.get("metadata", {})
            )
            for v in meta.get("versions", [])
        ]

        return CloudFile(
            file_path=target_path,
            size=meta.get("size", 0),
            modified_time=meta.get("modified_time", 0),
            upload_time=meta.get("upload_time", 0),
            versions=versions,
            metadata=meta.get("metadata", {})
        )

    def get_file_versions(self, target_path: str) -> List[CloudFileVersion]:
        file_info = self.get_file_info(target_path)
        return file_info.versions if file_info else []

    def get_modified_time(self, target_path: str) -> Optional[float]:
        file_info = self.get_file_info(target_path)
        return file_info.modified_time if file_info else None


class CloudStorageFactory:
    @staticmethod
    def create(config: CloudStorageConfig) -> CloudStorageClient:
        provider = config.provider.lower()

        if provider == "local":
            return LocalCloudStorageClient(config)
        elif provider == "s3":
            try:
                from .cloud_s3 import S3CloudStorageClient
                return S3CloudStorageClient(config)
            except ImportError:
                logger.warning("S3客户端不可用，使用本地模拟")
                return LocalCloudStorageClient(config)
        else:
            logger.warning(f"未知的云存储提供商: {provider}，使用本地模拟")
            return LocalCloudStorageClient(config)
