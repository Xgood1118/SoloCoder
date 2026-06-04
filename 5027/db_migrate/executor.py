import time
import logging
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum

from .database import DatabaseConnection, MigrationHistoryManager
from .migration import MigrationManager, MigrationScript

logger = logging.getLogger(__name__)


class MigrationStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class MigrationResult:
    version: str
    script_name: str
    status: MigrationStatus
    duration: float = 0.0
    error_message: Optional[str] = None
    checksum: Optional[str] = None


class MigrationExecutor:
    def __init__(self, db_connection: DatabaseConnection, 
                 migration_manager: MigrationManager,
                 history_manager: MigrationHistoryManager,
                 change_logger: Optional[Any] = None):
        self.db = db_connection
        self.migration_manager = migration_manager
        self.history_manager = history_manager
        self.change_logger = change_logger
        self.preview_mode = False
        self.operator = "system"

    def set_preview_mode(self, enabled: bool = True) -> None:
        self.preview_mode = enabled
        logger.info(f"Preview mode {'enabled' if enabled else 'disabled'}")

    def set_operator(self, operator: str) -> None:
        self.operator = operator

    def migrate(self, target_version: Optional[str] = None) -> List[MigrationResult]:
        current_version = self.history_manager.get_current_version()
        logger.info(f"Current database version: {current_version or 'None'}")

        scripts_to_run = self.migration_manager.get_upgrade_scripts(
            from_version=current_version,
            to_version=target_version
        )

        if not scripts_to_run:
            logger.info("No migrations to execute")
            return []

        logger.info(f"Found {len(scripts_to_run)} migration(s) to execute")
        
        if self.preview_mode:
            return self._preview_migrations(scripts_to_run)

        return self._execute_migrations(scripts_to_run)

    def _preview_migrations(self, scripts: List[MigrationScript]) -> List[MigrationResult]:
        logger.info("=== Migration Preview (No actual changes will be made) ===")
        results = []
        
        for i, script in enumerate(scripts, 1):
            logger.info(f"\n[{i}] Version {script.version}: {script.description}")
            logger.info(f"    Script: {script.name}")
            logger.info(f"    File: {script.file_path}")
            logger.info(f"    Checksum: {script.checksum[:16]}...")
            
            results.append(MigrationResult(
                version=script.version,
                script_name=script.name,
                status=MigrationStatus.PENDING,
                checksum=script.checksum
            ))

        logger.info(f"\n=== Total: {len(scripts)} migration(s) to be executed ===")
        return results

    def _execute_migrations(self, scripts: List[MigrationScript]) -> List[MigrationResult]:
        results = []

        for script in scripts:
            result = self._execute_single_migration(script)
            results.append(result)

            if result.status == MigrationStatus.FAILED:
                logger.error(f"Migration stopped due to failure in version {script.version}")
                break

        return results

    def _execute_single_migration(self, script: MigrationScript) -> MigrationResult:
        logger.info(f"Executing migration: {script.version} - {script.description}")
        start_time = time.time()

        try:
            with self.db.get_transaction() as conn:
                self.db.execute_script(script.content, connection=conn)
                
                duration = int((time.time() - start_time) * 1000)
                
                self.history_manager.record_migration(
                    version=script.version,
                    script_name=script.name,
                    description=script.description,
                    status="success",
                    duration=duration,
                    checksum=script.checksum,
                    operator=self.operator,
                    connection=conn
                )

            logger.info(f"Migration {script.version} completed successfully in {duration}ms")
            
            return MigrationResult(
                version=script.version,
                script_name=script.name,
                status=MigrationStatus.SUCCESS,
                duration=duration / 1000.0,
                checksum=script.checksum
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            logger.error(f"Migration {script.version} failed after {duration}ms: {error_msg}")
            
            return MigrationResult(
                version=script.version,
                script_name=script.name,
                status=MigrationStatus.FAILED,
                duration=duration / 1000.0,
                error_message=error_msg,
                checksum=script.checksum
            )

    def get_migration_plan(self, target_version: Optional[str] = None) -> Dict[str, Any]:
        current_version = self.history_manager.get_current_version()
        scripts_to_run = self.migration_manager.get_upgrade_scripts(
            from_version=current_version,
            to_version=target_version
        )

        plan = {
            "current_version": current_version,
            "target_version": target_version or self.migration_manager.get_latest_version(),
            "total_migrations": len(scripts_to_run),
            "migrations": []
        }

        for script in scripts_to_run:
            plan["migrations"].append({
                "version": script.version,
                "name": script.name,
                "description": script.description,
                "checksum": script.checksum,
                "has_rollback": self.migration_manager.has_rollback(script.version)
            })

        return plan

    def check_version_diff(self) -> Dict[str, Any]:
        db_version = self.history_manager.get_current_version()
        latest_script_version = self.migration_manager.get_latest_version()
        
        all_versions = self.migration_manager.get_versions()
        applied_versions = [m["version"] for m in self.history_manager.get_applied_migrations()]
        
        pending_versions = [v for v in all_versions if v not in applied_versions]
        
        return {
            "database_version": db_version,
            "latest_script_version": latest_script_version,
            "is_up_to_date": db_version == latest_script_version,
            "pending_migrations_count": len(pending_versions),
            "pending_versions": pending_versions,
            "applied_versions": applied_versions
        }
