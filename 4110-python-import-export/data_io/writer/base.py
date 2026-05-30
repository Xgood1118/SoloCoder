from __future__ import annotations

import abc
from typing import Any, Dict, Iterable, List, Optional

from data_io.models import Record


class BaseWriter(abc.ABC):
    def __init__(
        self,
        file_path: str,
        headers: Optional[List[str]] = None,
        encoding: str = "utf-8",
        **kwargs,
    ):
        self.file_path = file_path
        self.headers = headers or []
        self.encoding = encoding
        self._kwargs = kwargs
        self._initialized = False
        self._row_count = 0

    @abc.abstractmethod
    def _init_writer(self) -> None:
        ...

    @abc.abstractmethod
    def _write_header(self) -> None:
        ...

    @abc.abstractmethod
    def _write_row(self, data: Dict[str, Any]) -> None:
        ...

    @abc.abstractmethod
    def _finalize(self) -> None:
        ...

    def _ensure_initialized(self):
        if not self._initialized:
            self._init_writer()
            self._write_header()
            self._initialized = True

    def write_row(self, data: Dict[str, Any]) -> int:
        self._ensure_initialized()
        self._write_row(data)
        self._row_count += 1
        return self._row_count

    def write_rows(self, rows: Iterable[Dict[str, Any]]) -> int:
        count = 0
        for row in rows:
            self.write_row(row)
            count += 1
        return count

    def write_record(self, record: Record) -> int:
        return self.write_row(record.data)

    def write_records(self, records: Iterable[Record]) -> int:
        return self.write_rows(r.data for r in records)

    def flush(self) -> None:
        pass

    def close(self) -> None:
        if self._initialized:
            self._finalize()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    @property
    def row_count(self) -> int:
        return self._row_count
