import os
import logging
from typing import Optional, Dict, Any, List, Tuple
from contextlib import contextmanager
from sqlalchemy import create_engine, text, MetaData, Table, Column, Integer, String, DateTime, Text, Boolean, inspect
from sqlalchemy.engine import Engine, Connection
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseConnection:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.engine: Optional[Engine] = None
        self.metadata = MetaData()
        self._initialize_engine()

    def _initialize_engine(self) -> None:
        driver = self.config.get("driver", "mysql")
        host = self.config.get("host", "localhost")
        port = self.config.get("port", 3306)
        database = self.config.get("database", "")
        username = self.config.get("username", "")
        password = self.config.get("password", "")
        charset = self.config.get("charset", "utf8mb4")

        if driver == "mysql":
            url = f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}?charset={charset}"
        elif driver == "postgresql":
            url = f"postgresql+psycopg2://{username}:{password}@{host}:{port}/{database}"
        elif driver == "sqlite":
            db_dir = os.path.dirname(database)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)
            url = f"sqlite:///{database}"
        else:
            raise ValueError(f"Unsupported database driver: {driver}")

        self.engine = create_engine(url, pool_pre_ping=True, pool_recycle=3600)
        logger.info(f"Database engine initialized for {driver}://{host}:{port}/{database}")

    @contextmanager
    def get_connection(self) -> Connection:
        if not self.engine:
            raise RuntimeError("Database engine not initialized")
        
        connection = self.engine.connect()
        try:
            yield connection
        finally:
            connection.close()

    @contextmanager
    def get_transaction(self) -> Connection:
        with self.get_connection() as conn:
            trans = conn.begin()
            try:
                yield conn
                trans.commit()
                logger.debug("Transaction committed successfully")
            except Exception as e:
                trans.rollback()
                logger.error(f"Transaction rolled back due to error: {e}")
                raise

    def execute(self, sql: str, params: Optional[Dict[str, Any]] = None, 
                connection: Optional[Connection] = None) -> Any:
        def _execute(conn: Connection) -> Any:
            result = conn.execute(text(sql), params or {})
            return result

        if connection:
            return _execute(connection)
        
        with self.get_connection() as conn:
            return _execute(conn)

    def execute_script(self, sql_script: str, connection: Optional[Connection] = None) -> None:
        statements = self._split_sql_statements(sql_script)
        
        for stmt in statements:
            stmt = stmt.strip()
            if stmt:
                self.execute(stmt, connection=connection)

    def _split_sql_statements(self, sql_script: str) -> List[str]:
        statements = []
        current_statement = []
        in_string = False
        string_char = None

        for char in sql_script:
            if char in ("'", '"', '`'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
                    string_char = None
            
            if char == ';' and not in_string:
                statement = ''.join(current_statement).strip()
                if statement:
                    statements.append(statement)
                current_statement = []
            else:
                current_statement.append(char)

        final_statement = ''.join(current_statement).strip()
        if final_statement:
            statements.append(final_statement)

        return statements

    def table_exists(self, table_name: str) -> bool:
        insp = inspect(self.engine)
        return insp.has_table(table_name)

    def get_table_row_count(self, table_name: str) -> int:
        result = self.execute(f"SELECT COUNT(*) as count FROM {table_name}")
        row = result.fetchone()
        return row[0] if row else 0

    def get_table_indexes(self, table_name: str) -> List[Dict[str, Any]]:
        if self.config.get("driver") == "mysql":
            result = self.execute(f"SHOW INDEX FROM {table_name}")
            return [dict(row._mapping) for row in result.fetchall()]
        elif self.config.get("driver") == "postgresql":
            result = self.execute("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = :table_name
            """, {"table_name": table_name})
            return [dict(row._mapping) for row in result.fetchall()]
        return []

    def close(self) -> None:
        if self.engine:
            self.engine.dispose()
            logger.info("Database connection closed")


class MigrationHistoryManager:
    def __init__(self, db_connection: DatabaseConnection, table_name: str = "schema_migrations"):
        self.db = db_connection
        self.table_name = table_name
        self._ensure_table_exists()

    def _ensure_table_exists(self) -> None:
        if not self.db.table_exists(self.table_name):
            create_sql = f"""
            CREATE TABLE {self.table_name} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                version VARCHAR(50) NOT NULL UNIQUE,
                script_name VARCHAR(255) NOT NULL,
                description VARCHAR(255),
                execution_time DATETIME NOT NULL,
                execution_duration INT,
                status VARCHAR(20) NOT NULL,
                error_message TEXT,
                checksum VARCHAR(64),
                operator VARCHAR(50)
            )
            """
            if self.db.config.get("driver") == "postgresql":
                create_sql = f"""
                CREATE TABLE {self.table_name} (
                    id SERIAL PRIMARY KEY,
                    version VARCHAR(50) NOT NULL UNIQUE,
                    script_name VARCHAR(255) NOT NULL,
                    description VARCHAR(255),
                    execution_time TIMESTAMP NOT NULL,
                    execution_duration INT,
                    status VARCHAR(20) NOT NULL,
                    error_message TEXT,
                    checksum VARCHAR(64),
                    operator VARCHAR(50)
                )
                """
            elif self.db.config.get("driver") == "sqlite":
                create_sql = f"""
                CREATE TABLE {self.table_name} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version VARCHAR(50) NOT NULL UNIQUE,
                    script_name VARCHAR(255) NOT NULL,
                    description VARCHAR(255),
                    execution_time DATETIME NOT NULL,
                    execution_duration INT,
                    status VARCHAR(20) NOT NULL,
                    error_message TEXT,
                    checksum VARCHAR(64),
                    operator VARCHAR(50)
                )
                """
            
            self.db.execute(create_sql)
            logger.info(f"Created migration history table: {self.table_name}")

    def record_migration(self, version: str, script_name: str, description: str,
                         status: str, duration: int = 0, error_message: str = None,
                         checksum: str = None, operator: str = None,
                         connection: Connection = None) -> None:
        sql = f"""
        INSERT INTO {self.table_name} 
        (version, script_name, description, execution_time, execution_duration, 
         status, error_message, checksum, operator)
        VALUES (:version, :script_name, :description, :execution_time, :execution_duration,
                :status, :error_message, :checksum, :operator)
        """
        
        params = {
            "version": version,
            "script_name": script_name,
            "description": description,
            "execution_time": datetime.now(),
            "execution_duration": duration,
            "status": status,
            "error_message": error_message,
            "checksum": checksum,
            "operator": operator or "system"
        }

        self.db.execute(sql, params, connection=connection)
        logger.info(f"Recorded migration {version}: {status}")

    def get_applied_migrations(self) -> List[Dict[str, Any]]:
        sql = f"""
        SELECT version, script_name, description, execution_time, status, operator
        FROM {self.table_name}
        WHERE status = 'success'
        ORDER BY version ASC
        """
        result = self.db.execute(sql)
        return [dict(row._mapping) for row in result.fetchall()]

    def get_current_version(self) -> Optional[str]:
        sql = f"""
        SELECT version FROM {self.table_name}
        WHERE status = 'success'
        ORDER BY version DESC
        LIMIT 1
        """
        result = self.db.execute(sql)
        row = result.fetchone()
        return row[0] if row else None

    def migration_exists(self, version: str) -> bool:
        sql = f"SELECT COUNT(*) FROM {self.table_name} WHERE version = :version"
        result = self.db.execute(sql, {"version": version})
        row = result.fetchone()
        return row[0] > 0

    def delete_migration_record(self, version: str, connection: Connection = None) -> None:
        sql = f"DELETE FROM {self.table_name} WHERE version = :version"
        self.db.execute(sql, {"version": version}, connection=connection)
        logger.info(f"Deleted migration record for version: {version}")
