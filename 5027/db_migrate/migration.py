import os
import re
import hashlib
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class MigrationType(Enum):
    UPGRADE = "V"
    ROLLBACK = "R"


@dataclass
class MigrationScript:
    version: str
    name: str
    description: str
    type: MigrationType
    file_path: str
    checksum: str
    content: str = ""

    def load_content(self) -> None:
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.content = f.read()
        self.checksum = self._calculate_checksum()

    def _calculate_checksum(self) -> str:
        return hashlib.sha256(self.content.encode('utf-8')).hexdigest()


class MigrationManager:
    UPGRADE_PATTERN = re.compile(r'^V(\d+(?:\.\d+)*)__(\w+)\.sql$')
    ROLLBACK_PATTERN = re.compile(r'^R(\d+(?:\.\d+)*)__(\w+)\.sql$')

    def __init__(self, script_dir: str):
        self.script_dir = script_dir
        self._ensure_script_dir()
        self.upgrade_scripts: Dict[str, MigrationScript] = {}
        self.rollback_scripts: Dict[str, MigrationScript] = {}
        self.scan_scripts()

    def _ensure_script_dir(self) -> None:
        if not os.path.exists(self.script_dir):
            os.makedirs(self.script_dir, exist_ok=True)
            logger.info(f"Created migration script directory: {self.script_dir}")

    def scan_scripts(self) -> None:
        self.upgrade_scripts.clear()
        self.rollback_scripts.clear()

        if not os.path.exists(self.script_dir):
            return

        for filename in os.listdir(self.script_dir):
            file_path = os.path.join(self.script_dir, filename)
            
            if not os.path.isfile(file_path):
                continue

            upgrade_match = self.UPGRADE_PATTERN.match(filename)
            if upgrade_match:
                version = upgrade_match.group(1)
                name = upgrade_match.group(2)
                script = MigrationScript(
                    version=version,
                    name=name,
                    description=self._format_description(name),
                    type=MigrationType.UPGRADE,
                    file_path=file_path,
                    checksum=""
                )
                script.load_content()
                self.upgrade_scripts[version] = script
                logger.debug(f"Found upgrade script: {filename}")
                continue

            rollback_match = self.ROLLBACK_PATTERN.match(filename)
            if rollback_match:
                version = rollback_match.group(1)
                name = rollback_match.group(2)
                script = MigrationScript(
                    version=version,
                    name=name,
                    description=self._format_description(name),
                    type=MigrationType.ROLLBACK,
                    file_path=file_path,
                    checksum=""
                )
                script.load_content()
                self.rollback_scripts[version] = script
                logger.debug(f"Found rollback script: {filename}")

        logger.info(f"Scanned {len(self.upgrade_scripts)} upgrade scripts, "
                   f"{len(self.rollback_scripts)} rollback scripts")

    def _format_description(self, name: str) -> str:
        return name.replace('_', ' ').title()

    def get_upgrade_scripts(self, from_version: Optional[str] = None, 
                            to_version: Optional[str] = None) -> List[MigrationScript]:
        scripts = list(self.upgrade_scripts.values())
        
        def version_key(script: MigrationScript) -> Tuple:
            parts = script.version.split('.')
            return tuple(int(p) for p in parts)

        scripts.sort(key=version_key)

        if from_version:
            from_key = tuple(int(p) for p in from_version.split('.'))
            scripts = [s for s in scripts if version_key(s) > from_key]

        if to_version:
            to_key = tuple(int(p) for p in to_version.split('.'))
            scripts = [s for s in scripts if version_key(s) <= to_key]

        return scripts

    def get_rollback_script(self, version: str) -> Optional[MigrationScript]:
        return self.rollback_scripts.get(version)

    def get_versions(self) -> List[str]:
        versions = list(self.upgrade_scripts.keys())
        versions.sort(key=lambda v: tuple(int(p) for p in v.split('.')))
        return versions

    def get_latest_version(self) -> Optional[str]:
        versions = self.get_versions()
        return versions[-1] if versions else None

    def get_script(self, version: str) -> Optional[MigrationScript]:
        return self.upgrade_scripts.get(version)

    def has_rollback(self, version: str) -> bool:
        return version in self.rollback_scripts

    def compare_versions(self, v1: str, v2: str) -> int:
        key1 = tuple(int(p) for p in v1.split('.'))
        key2 = tuple(int(p) for p in v2.split('.'))
        if key1 < key2:
            return -1
        elif key1 > key2:
            return 1
        return 0
