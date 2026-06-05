import json
import shutil
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class DocumentVersion:
    document_id: str
    version_tag: str
    version_number: int
    content_hash: str
    created_at: str
    file_name: str
    file_size: int
    description: str = ""
    is_latest: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DocumentVersion":
        return cls(**data)


class VersionManager:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.version_config = self.config.versioning
        self.enabled = self.version_config.enabled
        self.max_versions = self.version_config.max_versions
        self.default_retrieve_latest = self.version_config.default_retrieve_latest
        self.hash_algorithm = self.version_config.hash_algorithm

        self.versions_dir = self.config.paths.versions_dir
        self.index_file = self.versions_dir / "version_index.json"
        self.versions_dir.mkdir(parents=True, exist_ok=True)

        self._version_index: Dict[str, List[DocumentVersion]] = {}
        self._load_index()

    def _load_index(self) -> None:
        if not self.index_file.exists():
            logger.info("No existing version index found, starting fresh")
            return

        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            for doc_id, versions_data in data.items():
                self._version_index[doc_id] = [
                    DocumentVersion.from_dict(v) for v in versions_data
                ]

            logger.info(
                f"Loaded version index with {len(self._version_index)} documents"
            )
        except Exception as e:
            logger.warning(f"Failed to load version index, starting fresh: {e}")
            self._version_index = {}

    def _save_index(self) -> None:
        try:
            data = {
                doc_id: [v.to_dict() for v in versions]
                for doc_id, versions in self._version_index.items()
            }
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info("Version index saved")
        except Exception as e:
            logger.error(f"Failed to save version index: {e}")

    def _get_version_dir(self, document_id: str, version_tag: str) -> Path:
        return self.versions_dir / document_id / version_tag

    def create_version(
        self,
        document_id: str,
        content_hash: str,
        file_name: str,
        file_size: int,
        description: str = "",
        source_files: Optional[List[Path]] = None,
    ) -> DocumentVersion:
        if not self.enabled:
            version = DocumentVersion(
                document_id=document_id,
                version_tag="latest",
                version_number=1,
                content_hash=content_hash,
                created_at=datetime.utcnow().isoformat() + "Z",
                file_name=file_name,
                file_size=file_size,
                description=description,
                is_latest=True,
            )
            self._version_index[document_id] = [version]
            return version

        existing_versions = self._version_index.get(document_id, [])

        for v in existing_versions:
            if v.content_hash == content_hash:
                logger.info(
                    f"Content unchanged for {document_id}, "
                    f"reusing version {v.version_tag}"
                )
                return v

        version_number = len(existing_versions) + 1
        version_tag = f"v{version_number}"
        created_at = datetime.utcnow().isoformat() + "Z"

        for v in existing_versions:
            v.is_latest = False

        new_version = DocumentVersion(
            document_id=document_id,
            version_tag=version_tag,
            version_number=version_number,
            content_hash=content_hash,
            created_at=created_at,
            file_name=file_name,
            file_size=file_size,
            description=description,
            is_latest=True,
        )

        existing_versions.append(new_version)
        self._version_index[document_id] = existing_versions

        if source_files:
            version_dir = self._get_version_dir(document_id, version_tag)
            version_dir.mkdir(parents=True, exist_ok=True)
            for src_file in source_files:
                if src_file.exists():
                    dst_file = version_dir / src_file.name
                    shutil.copy2(src_file, dst_file)
                    logger.debug(f"Copied {src_file} to version archive")

        latest_tag_path = self._get_version_dir(document_id, "latest")
        if latest_tag_path.exists():
            shutil.rmtree(latest_tag_path)
        if source_files:
            latest_tag_path.mkdir(parents=True, exist_ok=True)
            for src_file in source_files:
                if src_file.exists():
                    dst_file = latest_tag_path / src_file.name
                    shutil.copy2(src_file, dst_file)

        self._enforce_max_versions(document_id)
        self._save_index()

        logger.info(
            f"Created new version {version_tag} for {document_id} "
            f"(total versions: {version_number})"
        )
        return new_version

    def _enforce_max_versions(self, document_id: str) -> None:
        versions = self._version_index.get(document_id, [])
        if len(versions) <= self.max_versions:
            return

        versions_to_remove = versions[: -self.max_versions]
        remaining_versions = versions[-self.max_versions :]

        for v in versions_to_remove:
            version_dir = self._get_version_dir(document_id, v.version_tag)
            if version_dir.exists():
                shutil.rmtree(version_dir)
                logger.info(
                    f"Removed old version {v.version_tag} for {document_id}"
                )

        self._version_index[document_id] = remaining_versions

    def get_versions(self, document_id: str) -> List[DocumentVersion]:
        versions = self._version_index.get(document_id, [])
        return sorted(versions, key=lambda v: v.version_number, reverse=True)

    def get_version(self, document_id: str, version_tag: str) -> Optional[DocumentVersion]:
        versions = self._version_index.get(document_id, [])
        for v in versions:
            if v.version_tag == version_tag:
                return v
        return None

    def get_latest_version(self, document_id: str) -> Optional[DocumentVersion]:
        versions = self._version_index.get(document_id, [])
        for v in versions:
            if v.is_latest:
                return v
        return versions[-1] if versions else None

    def get_version_files(
        self,
        document_id: str,
        version_tag: str,
    ) -> List[Path]:
        version_dir = self._get_version_dir(document_id, version_tag)
        if not version_dir.exists():
            return []
        return sorted(version_dir.iterdir())

    def get_version_file(
        self,
        document_id: str,
        version_tag: str,
        file_name: str,
    ) -> Optional[Path]:
        version_dir = self._get_version_dir(document_id, version_tag)
        file_path = version_dir / file_name
        return file_path if file_path.exists() else None

    def list_all_documents(self) -> List[Dict[str, Any]]:
        result = []
        for doc_id, versions in self._version_index.items():
            latest = self.get_latest_version(doc_id)
            result.append(
                {
                    "document_id": doc_id,
                    "latest_version": latest.version_tag if latest else None,
                    "latest_file_name": latest.file_name if latest else None,
                    "version_count": len(versions),
                    "versions": [v.to_dict() for v in self.get_versions(doc_id)],
                }
            )
        return result

    def has_document(self, document_id: str) -> bool:
        return document_id in self._version_index and len(self._version_index[document_id]) > 0

    def get_content_hash(self, document_id: str, version_tag: Optional[str] = None) -> Optional[str]:
        if version_tag is None:
            latest = self.get_latest_version(document_id)
            return latest.content_hash if latest else None

        version = self.get_version(document_id, version_tag)
        return version.content_hash if version else None

    def delete_version(self, document_id: str, version_tag: str) -> bool:
        versions = self._version_index.get(document_id, [])
        version_to_delete = None
        for i, v in enumerate(versions):
            if v.version_tag == version_tag:
                version_to_delete = v
                del versions[i]
                break

        if not version_to_delete:
            return False

        version_dir = self._get_version_dir(document_id, version_tag)
        if version_dir.exists():
            shutil.rmtree(version_dir)

        if version_to_delete.is_latest and versions:
            versions[-1].is_latest = True

        if versions:
            self._version_index[document_id] = versions
        else:
            del self._version_index[document_id]

        self._save_index()
        logger.info(f"Deleted version {version_tag} for {document_id}")
        return True

    def delete_all_versions(self, document_id: str) -> int:
        versions = self._version_index.get(document_id, [])
        count = len(versions)

        for v in versions:
            version_dir = self._get_version_dir(document_id, v.version_tag)
            if version_dir.exists():
                shutil.rmtree(version_dir)

        latest_dir = self._get_version_dir(document_id, "latest")
        if latest_dir.exists():
            shutil.rmtree(latest_dir)

        if document_id in self._version_index:
            del self._version_index[document_id]

        self._save_index()
        logger.info(f"Deleted all {count} versions for {document_id}")
        return count

    def compare_versions(
        self,
        document_id: str,
        version_tag1: str,
        version_tag2: str,
    ) -> Dict[str, Any]:
        v1 = self.get_version(document_id, version_tag1)
        v2 = self.get_version(document_id, version_tag2)

        if not v1 or not v2:
            return {"error": "One or both versions not found"}

        return {
            "document_id": document_id,
            "version1": v1.to_dict(),
            "version2": v2.to_dict(),
            "content_changed": v1.content_hash != v2.content_hash,
            "file_size_changed": v1.file_size != v2.file_size,
            "days_between": (
                datetime.fromisoformat(v2.created_at.replace("Z", ""))
                - datetime.fromisoformat(v1.created_at.replace("Z", ""))
            ).days,
        }


from .config import get_config
