import hashlib
import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set

from .exceptions import PluginPermissionError, PluginSecurityError
from .utils import get_logger


logger = get_logger("security")


class Permission:
    READ_FILE = "file:read"
    WRITE_FILE = "file:write"
    READ_NETWORK = "network:read"
    WRITE_NETWORK = "network:write"
    EXECUTE_COMMAND = "system:execute"
    ACCESS_DATABASE = "database:access"
    ACCESS_CONFIG = "config:access"
    SEND_EVENTS = "events:send"
    RECEIVE_EVENTS = "events:receive"
    CALL_PLUGIN = "plugin:call"

    ALL_PERMISSIONS = {
        READ_FILE,
        WRITE_FILE,
        READ_NETWORK,
        WRITE_NETWORK,
        EXECUTE_COMMAND,
        ACCESS_DATABASE,
        ACCESS_CONFIG,
        SEND_EVENTS,
        RECEIVE_EVENTS,
        CALL_PLUGIN,
    }


@dataclass
class AuditLogEntry:
    timestamp: float
    plugin_name: str
    action: str
    resource: Optional[str] = None
    granted: bool = False
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "plugin_name": self.plugin_name,
            "action": self.action,
            "resource": self.resource,
            "granted": self.granted,
            "details": self.details,
        }


class SecurityManager:
    def __init__(self, auto_approve: bool = False):
        self._permissions: Dict[str, Set[str]] = {}
        self._requested_permissions: Dict[str, Set[str]] = {}
        self._auto_approve = auto_approve
        self._approval_callbacks: List[Callable] = []
        self._audit_log: List[AuditLogEntry] = []
        self._max_audit_logs = 10000
        self._lock = threading.RLock()

    def register_plugin_permissions(self, plugin_name: str, permissions: List[str]) -> None:
        with self._lock:
            self._requested_permissions[plugin_name] = set(permissions)

            if self._auto_approve:
                self._permissions[plugin_name] = set(permissions)
                logger.info(f"Auto-approved permissions for {plugin_name}: {permissions}")

    def request_permission(self, plugin_name: str, permission: str) -> bool:
        with self._lock:
            if self.has_permission(plugin_name, permission):
                self._log_audit(plugin_name, "permission_check", permission, True)
                return True

            if self._auto_approve:
                self.grant_permission(plugin_name, permission)
                self._log_audit(plugin_name, "permission_granted", permission, True)
                return True

            self._log_audit(plugin_name, "permission_denied", permission, False)

            for callback in self._approval_callbacks:
                try:
                    callback(plugin_name, permission)
                except Exception as e:
                    logger.error(f"Error in approval callback: {e}")

            return False

    def check_permission(self, plugin_name: str, permission: str) -> None:
        if not self.has_permission(plugin_name, permission):
            self._log_audit(plugin_name, "permission_denied", permission, False)
            raise PluginPermissionError(plugin_name, permission)

    def has_permission(self, plugin_name: str, permission: str) -> bool:
        with self._lock:
            granted = self._permissions.get(plugin_name, set())
            return permission in granted

    def grant_permission(self, plugin_name: str, permission: str) -> None:
        with self._lock:
            if plugin_name not in self._permissions:
                self._permissions[plugin_name] = set()
            self._permissions[plugin_name].add(permission)
            self._log_audit(plugin_name, "permission_granted", permission, True)
            logger.info(f"Granted permission '{permission}' to plugin '{plugin_name}'")

    def revoke_permission(self, plugin_name: str, permission: str) -> None:
        with self._lock:
            if plugin_name in self._permissions:
                self._permissions[plugin_name].discard(permission)
                self._log_audit(plugin_name, "permission_revoked", permission, True)
                logger.info(f"Revoked permission '{permission}' from plugin '{plugin_name}'")

    def get_requested_permissions(self, plugin_name: str) -> Set[str]:
        with self._lock:
            return self._requested_permissions.get(plugin_name, set()).copy()

    def get_granted_permissions(self, plugin_name: str) -> Set[str]:
        with self._lock:
            return self._permissions.get(plugin_name, set()).copy()

    def add_approval_callback(self, callback: Callable[[str, str], None]) -> None:
        self._approval_callbacks.append(callback)

    def remove_approval_callback(self, callback: Callable) -> None:
        if callback in self._approval_callbacks:
            self._approval_callbacks.remove(callback)

    def _log_audit(
        self,
        plugin_name: str,
        action: str,
        resource: Optional[str] = None,
        granted: bool = False,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        entry = AuditLogEntry(
            timestamp=time.time(),
            plugin_name=plugin_name,
            action=action,
            resource=resource,
            granted=granted,
            details=details or {},
        )
        self._audit_log.append(entry)

        if len(self._audit_log) > self._max_audit_logs:
            self._audit_log = self._audit_log[-self._max_audit_logs:]

    def get_audit_log(
        self,
        plugin_name: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
    ) -> List[AuditLogEntry]:
        with self._lock:
            logs = reversed(self._audit_log)
            if plugin_name:
                logs = [l for l in logs if l.plugin_name == plugin_name]
            if action:
                logs = [l for l in logs if l.action == action]
            return list(logs)[:limit]


class PluginSignatureVerifier:
    def __init__(self, public_keys_dir: Optional[str] = None):
        self.public_keys_dir = Path(public_keys_dir) if public_keys_dir else None
        self._trusted_keys: Dict[str, str] = {}

    def add_trusted_key(self, author_id: str, public_key: str) -> None:
        self._trusted_keys[author_id] = public_key

    def calculate_file_hash(self, file_path: str, algorithm: str = "sha256") -> str:
        path = Path(file_path)
        if not path.exists():
            raise PluginSecurityError(f"File not found: {file_path}")

        hasher = hashlib.new(algorithm)
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def calculate_directory_hash(
        self,
        dir_path: str,
        algorithm: str = "sha256",
        ignore_patterns: Optional[List[str]] = None,
    ) -> str:
        path = Path(dir_path)
        if not path.is_dir():
            raise PluginSecurityError(f"Directory not found: {dir_path}")

        ignore = set(ignore_patterns or [])
        hasher = hashlib.new(algorithm)

        files = []
        for file_path in path.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(path)
                if not any(p in str(rel_path) for p in ignore):
                    files.append(file_path)

        files.sort()
        for file_path in files:
            file_hash = self.calculate_file_hash(str(file_path), algorithm)
            hasher.update(f"{file_path.relative_to(path)}:{file_hash}".encode())

        return hasher.hexdigest()

    def verify_plugin_signature(
        self, plugin_path: str, signature_file: Optional[str] = None
    ) -> bool:
        path = Path(plugin_path)

        if not signature_file:
            signature_file = str(path / "signature.json")

        sig_path = Path(signature_file)
        if not sig_path.exists():
            logger.warning(f"Signature file not found: {signature_file}")
            return False

        try:
            with open(sig_path, "r", encoding="utf-8") as f:
                signature_data = json.load(f)

            expected_hash = signature_data.get("hash")
            algorithm = signature_data.get("algorithm", "sha256")
            author = signature_data.get("author")

            actual_hash = self.calculate_directory_hash(
                plugin_path, algorithm, ignore_patterns=["signature.json"]
            )

            if actual_hash != expected_hash:
                logger.error(f"Signature verification failed for {plugin_path}: hash mismatch")
                return False

            if author and author in self._trusted_keys:
                logger.info(f"Plugin {plugin_path} signed by trusted author: {author}")

            return True

        except Exception as e:
            logger.error(f"Error verifying signature for {plugin_path}: {e}")
            return False

    def create_plugin_signature(
        self,
        plugin_path: str,
        author: str,
        output_file: Optional[str] = None,
        algorithm: str = "sha256",
    ) -> Dict[str, Any]:
        path = Path(plugin_path)

        if not output_file:
            output_file = str(path / "signature.json")

        file_hash = self.calculate_directory_hash(
            plugin_path, algorithm, ignore_patterns=["signature.json"]
        )

        signature_data = {
            "author": author,
            "algorithm": algorithm,
            "hash": file_hash,
            "timestamp": time.time(),
            "version": "1.0",
        }

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(signature_data, f, indent=2)

        logger.info(f"Created signature for {plugin_path}: {output_file}")
        return signature_data
