import time
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

from .database import DatabaseConnection, MigrationHistoryManager
from .migration import MigrationManager, MigrationScript

logger = logging.getLogger(__name__)


class RollbackStatus(Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    NO_ROLLBACK = "no_rollback_script"


@dataclass
class RollbackResult:
    version: str
    status: RollbackStatus
    duration: float = 0.0
    error_message: Optional[str] = None


class RollbackManager:
    def __init__(self, db_connection: DatabaseConnection,
                 migration_manager: MigrationManager,
                 history_manager: MigrationHistoryManager):
        self.db = db_connection
        self.migration_manager = migration_manager
        self.history_manager = history_manager
        self.preview_mode = False
        self.operator = "system"

    def set_preview_mode(self, enabled: bool = True) -> None:
        self.preview_mode = enabled
        logger.info(f"Rollback preview mode {'enabled' if enabled else 'disabled'}")

    def set_operator(self, operator: str) -> None:
        self.operator = operator

    def rollback_to_version(self, target_version: str) -> List[RollbackResult]:
        applied_migrations = self.history_manager.get_applied_migrations()
        current_version = self.history_manager.get_current_version()

        if not current_version:
            logger.info("No migrations have been applied, nothing to rollback")
            return []

        if self.migration_manager.compare_versions(current_version, target_version) <= 0:
            logger.info(f"Current version {current_version} is already at or below target version {target_version}")
            return []

        versions_to_rollback = []
        for migration in reversed(applied_migrations):
            ver = migration["version"]
            if self.migration_manager.compare_versions(ver, target_version) > 0:
                versions_to_rollback.append(ver)
            else:
                break

        logger.info(f"Need to rollback {len(versions_to_rollback)} version(s) to reach {target_version}")

        if self.preview_mode:
            return self._preview_rollbacks(versions_to_rollback)

        return self._execute_rollbacks(versions_to_rollback)

    def rollback_last_n(self, n: int = 1) -> List[RollbackResult]:
        applied_migrations = self.history_manager.get_applied_migrations()

        if not applied_migrations:
            logger.info("No migrations have been applied, nothing to rollback")
            return []

        versions_to_rollback = [m["version"] for m in reversed(applied_migrations[-n:])]
        
        logger.info(f"Rolling back last {min(n, len(versions_to_rollback))} migration(s)")

        if self.preview_mode:
            return self._preview_rollbacks(versions_to_rollback)

        return self._execute_rollbacks(versions_to_rollback)

    def _preview_rollbacks(self, versions: List[str]) -> List[RollbackResult]:
        logger.info("=== Rollback Preview (No actual changes will be made) ===")
        results = []

        for i, version in enumerate(versions, 1):
            has_rollback = self.migration_manager.has_rollback(version)
            rollback_script = self.migration_manager.get_rollback_script(version)

            logger.info(f"\n[{i}] Rollback version {version}")
            if has_rollback and rollback_script:
                logger.info(f"    Rollback script: {rollback_script.name}")
                logger.info(f"    File: {rollback_script.file_path}")
                status = RollbackStatus.PENDING
            else:
                logger.warning(f"    No rollback script found for version {version}")
                status = RollbackStatus.NO_ROLLBACK

            results.append(RollbackResult(
                version=version,
                status=status
            ))

        logger.info(f"\n=== Total: {len(versions)} rollback(s) to be executed ===")
        return results

    def _execute_rollbacks(self, versions: List[str]) -> List[RollbackResult]:
        results = []

        for version in versions:
            result = self._execute_single_rollback(version)
            results.append(result)

            if result.status == RollbackStatus.FAILED:
                logger.error(f"Rollback stopped due to failure in version {version}")
                break

        return results

    def _execute_single_rollback(self, version: str) -> RollbackResult:
        logger.info(f"Executing rollback for version: {version}")
        
        rollback_script = self.migration_manager.get_rollback_script(version)
        
        if not rollback_script:
            logger.warning(f"No rollback script found for version {version}, skipping")
            return RollbackResult(
                version=version,
                status=RollbackStatus.NO_ROLLBACK
            )

        start_time = time.time()

        try:
            with self.db.get_transaction() as conn:
                self.db.execute_script(rollback_script.content, connection=conn)
                
                duration = int((time.time() - start_time) * 1000)
                
                self.history_manager.delete_migration_record(
                    version=version,
                    connection=conn
                )

            logger.info(f"Rollback {version} completed successfully in {duration}ms")
            
            return RollbackResult(
                version=version,
                status=RollbackStatus.SUCCESS,
                duration=duration / 1000.0
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            logger.error(f"Rollback {version} failed after {duration}ms: {error_msg}")
            
            return RollbackResult(
                version=version,
                status=RollbackStatus.FAILED,
                duration=duration / 1000.0,
                error_message=error_msg
            )

    def get_rollback_plan(self, target_version: str) -> Dict[str, Any]:
        applied_migrations = self.history_manager.get_applied_migrations()
        current_version = self.history_manager.get_current_version()

        if not current_version:
            return {
                "current_version": None,
                "target_version": target_version,
                "total_rollbacks": 0,
                "rollbacks": [],
                "message": "No migrations have been applied"
            }

        versions_to_rollback = []
        for migration in reversed(applied_migrations):
            ver = migration["version"]
            if self.migration_manager.compare_versions(ver, target_version) > 0:
                versions_to_rollback.append(ver)
            else:
                break

        plan = {
            "current_version": current_version,
            "target_version": target_version,
            "total_rollbacks": len(versions_to_rollback),
            "rollbacks": []
        }

        for version in versions_to_rollback:
            rollback_script = self.migration_manager.get_rollback_script(version)
            plan["rollbacks"].append({
                "version": version,
                "has_rollback_script": rollback_script is not None,
                "script_name": rollback_script.name if rollback_script else None
            })

        return plan
