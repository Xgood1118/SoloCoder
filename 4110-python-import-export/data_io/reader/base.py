from __future__ import annotations

import abc
from typing import Dict, Iterator, List, Optional, Tuple

from data_io.models import Record


class BaseReader(abc.ABC):
    def __init__(self, file_path: str, encoding: Optional[str] = None, **kwargs):
        self.file_path = file_path
        self.encoding = encoding
        self._kwargs = kwargs

    @abc.abstractmethod
    def read_headers(self) -> List[str]:
        ...

    @abc.abstractmethod
    def read_rows(
        self,
        start: int = 0,
        batch_size: Optional[int] = None,
    ) -> Iterator[Record]:
        ...

    @abc.abstractmethod
    def total_rows(self) -> int:
        ...

    def read_all(self) -> List[Record]:
        return list(self.read_rows())

    def read_batch(self, start: int = 0, batch_size: int = 1000) -> List[Record]:
        rows = []
        for i, record in enumerate(self.read_rows(start=start)):
            if i >= batch_size:
                break
            rows.append(record)
        return rows

    def preview(self, count: int = 5) -> List[Record]:
        return self.read_batch(start=0, batch_size=count)
