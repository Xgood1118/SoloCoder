from __future__ import annotations

import base64
import hashlib
import os
import sqlite3
from typing import Any, Dict, Iterator, List, Optional

from data_io.models import DataSourceConfig


class SimpleCrypto:
    def __init__(self, key: Optional[str] = None):
        self._key = key or os.environ.get("DATA_IO_SECRET", "default-secret-change-me")

    def _derive_key(self) -> bytes:
        return hashlib.sha256(self._key.encode()).digest()

    def encrypt(self, plaintext: str) -> str:
        key = self._derive_key()
        data = plaintext.encode("utf-8")
        repeated_key = (key * (len(data) // len(key) + 1))[:len(data)]
        result = bytes(a ^ b for a, b in zip(data, repeated_key))
        return base64.b64encode(result).decode("ascii")

    def decrypt(self, ciphertext: str) -> str:
        key = self._derive_key()
        data = base64.b64decode(ciphertext.encode("ascii"))
        repeated_key = (key * (len(data) // len(key) + 1))[:len(data)]
        result = bytes(a ^ b for a, b in zip(data, repeated_key))
        return result.decode("utf-8")


crypto = SimpleCrypto()


class BaseDatabaseClient:
    def __init__(self, config: DataSourceConfig):
        self.config = config
        self._connection = None
        self._crypto = SimpleCrypto()

    def _get_password(self) -> Optional[str]:
        if self.config.encrypted_password:
            return self._crypto.decrypt(self.config.encrypted_password)
        return self.config.password

    @property
    def is_connected(self) -> bool:
        return self._connection is not None

    def connect(self):
        raise NotImplementedError

    def disconnect(self):
        if self._connection:
            try:
                self._connection.close()
            except Exception:
                pass
            self._connection = None

    def execute(self, query: str, params: Optional[tuple] = None):
        raise NotImplementedError

    def query(
        self,
        query: str,
        params: Optional[tuple] = None,
        batch_size: int = 1000,
    ) -> Iterator[Dict[str, Any]]:
        raise NotImplementedError

    def insert_batch(self, table_name: str, rows: List[Dict[str, Any]]) -> int:
        raise NotImplementedError

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()
        return False


class SQLiteClient(BaseDatabaseClient):
    def connect(self):
        db_path = self.config.database or ":memory:"
        self._connection = sqlite3.connect(db_path)
        self._connection.row_factory = sqlite3.Row
        return self._connection

    def execute(self, query: str, params: Optional[tuple] = None):
        cursor = self._connection.cursor()
        cursor.execute(query, params or ())
        self._connection.commit()
        return cursor

    def query(
        self,
        query: str,
        params: Optional[tuple] = None,
        batch_size: int = 1000,
    ) -> Iterator[Dict[str, Any]]:
        cursor = self._connection.cursor()
        cursor.execute(query, params or ())
        while True:
            batch = cursor.fetchmany(batch_size)
            if not batch:
                break
            for row in batch:
                yield dict(row)

    def insert_batch(self, table_name: str, rows: List[Dict[str, Any]]) -> int:
        if not rows:
            return 0
        columns = list(rows[0].keys())
        placeholders = ", ".join(["?" for _ in columns])
        columns_str = ", ".join(columns)
        query = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
        cursor = self._connection.cursor()
        data = [tuple(row.get(col) for col in columns) for row in rows]
        cursor.executemany(query, data)
        self._connection.commit()
        return cursor.rowcount


class MySQLClient(BaseDatabaseClient):
    def connect(self):
        try:
            import pymysql
        except ImportError:
            raise ImportError("pymysql is required for MySQL support. Install with: pip install pymysql")
        self._connection = pymysql.connect(
            host=self.config.host or "localhost",
            port=self.config.port or 3306,
            user=self.config.username,
            password=self._get_password(),
            database=self.config.database,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
        return self._connection

    def execute(self, query: str, params: Optional[tuple] = None):
        with self._connection.cursor() as cursor:
            cursor.execute(query, params or ())
            self._connection.commit()
            return cursor

    def query(
        self,
        query: str,
        params: Optional[tuple] = None,
        batch_size: int = 1000,
    ) -> Iterator[Dict[str, Any]]:
        with self._connection.cursor() as cursor:
            cursor.execute(query, params or ())
            while True:
                batch = cursor.fetchmany(batch_size)
                if not batch:
                    break
                for row in batch:
                    yield row

    def insert_batch(self, table_name: str, rows: List[Dict[str, Any]]) -> int:
        if not rows:
            return 0
        columns = list(rows[0].keys())
        placeholders = ", ".join(["%s" for _ in columns])
        columns_str = ", ".join([f"`{c}`" for c in columns])
        query = f"INSERT INTO `{table_name}` ({columns_str}) VALUES ({placeholders})"
        with self._connection.cursor() as cursor:
            data = [tuple(row.get(col) for col in columns) for row in rows]
            cursor.executemany(query, data)
            self._connection.commit()
            return cursor.rowcount


class PostgreSQLClient(BaseDatabaseClient):
    def connect(self):
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
        except ImportError:
            raise ImportError("psycopg2 is required for PostgreSQL support. Install with: pip install psycopg2-binary")
        self._connection = psycopg2.connect(
            host=self.config.host or "localhost",
            port=self.config.port or 5432,
            user=self.config.username,
            password=self._get_password(),
            dbname=self.config.database,
            cursor_factory=RealDictCursor,
        )
        return self._connection

    def execute(self, query: str, params: Optional[tuple] = None):
        cursor = self._connection.cursor()
        cursor.execute(query, params or ())
        self._connection.commit()
        return cursor

    def query(
        self,
        query: str,
        params: Optional[tuple] = None,
        batch_size: int = 1000,
    ) -> Iterator[Dict[str, Any]]:
        cursor = self._connection.cursor()
        cursor.execute(query, params or ())
        while True:
            batch = cursor.fetchmany(batch_size)
            if not batch:
                break
            for row in batch:
                yield dict(row)

    def insert_batch(self, table_name: str, rows: List[Dict[str, Any]]) -> int:
        if not rows:
            return 0
        columns = list(rows[0].keys())
        placeholders = ", ".join([f"%s" for _ in columns])
        columns_str = ", ".join([f'"{c}"' for c in columns])
        query = f'INSERT INTO "{table_name}" ({columns_str}) VALUES ({placeholders})'
        cursor = self._connection.cursor()
        data = [tuple(row.get(col) for col in columns) for row in rows]
        cursor.executemany(query, data)
        self._connection.commit()
        return cursor.rowcount


CLIENT_REGISTRY = {
    "sqlite": SQLiteClient,
    "mysql": MySQLClient,
    "postgres": PostgreSQLClient,
    "postgresql": PostgreSQLClient,
}


def get_database_client(config: DataSourceConfig) -> BaseDatabaseClient:
    client_class = CLIENT_REGISTRY.get(config.db_type.lower())
    if client_class is None:
        raise ValueError(f"Unsupported database type: {config.db_type}")
    return client_class(config)
