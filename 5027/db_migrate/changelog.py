import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.engine import Connection

from .database import DatabaseConnection

logger = logging.getLogger(__name__)


class ChangeLogger:
    def __init__(self, db_connection: DatabaseConnection, table_name: str = "data_change_log"):
        self.db = db_connection
        self.table_name = table_name
        self._ensure_table_exists()

    def _ensure_table_exists(self) -> None:
        if not self.db.table_exists(self.table_name):
            create_sql = f"""
            CREATE TABLE {self.table_name} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                operation_type VARCHAR(20) NOT NULL,
                table_name VARCHAR(100) NOT NULL,
                primary_key_value VARCHAR(255),
                before_data JSON,
                after_data JSON,
                changed_columns TEXT,
                migration_version VARCHAR(50),
                operator VARCHAR(50),
                operation_time DATETIME NOT NULL,
                ip_address VARCHAR(50),
                remark VARCHAR(500)
            )
            """
            if self.db.config.get("driver") == "postgresql":
                create_sql = f"""
                CREATE TABLE {self.table_name} (
                    id SERIAL PRIMARY KEY,
                    operation_type VARCHAR(20) NOT NULL,
                    table_name VARCHAR(100) NOT NULL,
                    primary_key_value VARCHAR(255),
                    before_data JSONB,
                    after_data JSONB,
                    changed_columns TEXT,
                    migration_version VARCHAR(50),
                    operator VARCHAR(50),
                    operation_time TIMESTAMP NOT NULL,
                    ip_address VARCHAR(50),
                    remark VARCHAR(500)
                )
                """
            elif self.db.config.get("driver") == "sqlite":
                create_sql = f"""
                CREATE TABLE {self.table_name} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    operation_type VARCHAR(20) NOT NULL,
                    table_name VARCHAR(100) NOT NULL,
                    primary_key_value VARCHAR(255),
                    before_data TEXT,
                    after_data TEXT,
                    changed_columns TEXT,
                    migration_version VARCHAR(50),
                    operator VARCHAR(50),
                    operation_time DATETIME NOT NULL,
                    ip_address VARCHAR(50),
                    remark VARCHAR(500)
                )
                """
            
            self.db.execute(create_sql)
            logger.info(f"Created change log table: {self.table_name}")

    def log_change(self, operation_type: str, table_name: str, 
                   before_data: Optional[Dict[str, Any]] = None,
                   after_data: Optional[Dict[str, Any]] = None,
                   primary_key_value: Optional[str] = None,
                   migration_version: Optional[str] = None,
                   operator: Optional[str] = None,
                   ip_address: Optional[str] = None,
                   remark: Optional[str] = None,
                   connection: Optional[Connection] = None) -> None:
        
        changed_columns = self._get_changed_columns(before_data, after_data)
        
        sql = f"""
        INSERT INTO {self.table_name}
        (operation_type, table_name, primary_key_value, before_data, after_data,
         changed_columns, migration_version, operator, operation_time, ip_address, remark)
        VALUES (:operation_type, :table_name, :primary_key_value, :before_data, :after_data,
                :changed_columns, :migration_version, :operator, :operation_time, :ip_address, :remark)
        """
        
        params = {
            "operation_type": operation_type.upper(),
            "table_name": table_name,
            "primary_key_value": primary_key_value,
            "before_data": self._json_dumps(before_data),
            "after_data": self._json_dumps(after_data),
            "changed_columns": ",".join(changed_columns) if changed_columns else None,
            "migration_version": migration_version,
            "operator": operator or "system",
            "operation_time": datetime.now(),
            "ip_address": ip_address,
            "remark": remark
        }

        self.db.execute(sql, params, connection=connection)
        logger.debug(f"Logged {operation_type} change on {table_name}")

    def _json_dumps(self, data: Optional[Dict[str, Any]]) -> Optional[str]:
        if data is None:
            return None
        return json.dumps(data, ensure_ascii=False, default=str)

    def _get_changed_columns(self, before_data: Optional[Dict[str, Any]], 
                             after_data: Optional[Dict[str, Any]]) -> List[str]:
        changed = []
        
        if not before_data or not after_data:
            return changed

        all_keys = set(before_data.keys()) | set(after_data.keys())
        
        for key in all_keys:
            before_val = before_data.get(key)
            after_val = after_data.get(key)
            if before_val != after_val:
                changed.append(key)

        return changed

    def log_insert(self, table_name: str, after_data: Dict[str, Any],
                   primary_key_value: Optional[str] = None, **kwargs) -> None:
        self.log_change(
            operation_type="INSERT",
            table_name=table_name,
            after_data=after_data,
            primary_key_value=primary_key_value,
            **kwargs
        )

    def log_update(self, table_name: str, before_data: Dict[str, Any],
                   after_data: Dict[str, Any], 
                   primary_key_value: Optional[str] = None, **kwargs) -> None:
        self.log_change(
            operation_type="UPDATE",
            table_name=table_name,
            before_data=before_data,
            after_data=after_data,
            primary_key_value=primary_key_value,
            **kwargs
        )

    def log_delete(self, table_name: str, before_data: Dict[str, Any],
                   primary_key_value: Optional[str] = None, **kwargs) -> None:
        self.log_change(
            operation_type="DELETE",
            table_name=table_name,
            before_data=before_data,
            primary_key_value=primary_key_value,
            **kwargs
        )

    def get_change_logs(self, table_name: Optional[str] = None,
                        operation_type: Optional[str] = None,
                        migration_version: Optional[str] = None,
                        start_time: Optional[datetime] = None,
                        end_time: Optional[datetime] = None,
                        limit: int = 100) -> List[Dict[str, Any]]:
        conditions = []
        params = {}

        if table_name:
            conditions.append("table_name = :table_name")
            params["table_name"] = table_name

        if operation_type:
            conditions.append("operation_type = :operation_type")
            params["operation_type"] = operation_type.upper()

        if migration_version:
            conditions.append("migration_version = :migration_version")
            params["migration_version"] = migration_version

        if start_time:
            conditions.append("operation_time >= :start_time")
            params["start_time"] = start_time

        if end_time:
            conditions.append("operation_time <= :end_time")
            params["end_time"] = end_time

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        sql = f"""
        SELECT * FROM {self.table_name}
        WHERE {where_clause}
        ORDER BY operation_time DESC, id DESC
        LIMIT :limit
        """
        params["limit"] = limit

        result = self.db.execute(sql, params)
        return [dict(row._mapping) for row in result.fetchall()]

    def get_changes_by_migration(self, migration_version: str) -> List[Dict[str, Any]]:
        return self.get_change_logs(migration_version=migration_version)
