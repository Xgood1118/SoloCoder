from __future__ import annotations

import json
import os
from typing import Any, Dict, Iterator, List, Optional

from data_io.reader.base import BaseReader
from data_io.models import Record


class JsonReader(BaseReader):
    def __init__(
        self,
        file_path: str,
        encoding: Optional[str] = None,
        json_path: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(file_path, encoding, **kwargs)
        self.json_path = json_path
        self._encoding = encoding or "utf-8"
        self._headers: Optional[List[str]] = None
        self._total: Optional[int] = None

    def _load_data(self) -> Any:
        with open(self.file_path, "r", encoding=self._encoding) as f:
            return json.load(f)

    def _get_iterable(self) -> List[Dict]:
        data = self._load_data()
        if self.json_path:
            parts = self.json_path.split(".")
            for p in parts:
                if isinstance(data, dict) and p in data:
                    data = data[p]
                elif isinstance(data, list) and p.isdigit():
                    idx = int(p)
                    if idx < len(data):
                        data = data[idx]
        if isinstance(data, dict):
            return [data]
        if not isinstance(data, list):
            raise ValueError(f"JSON data is not a list: {type(data)}")
        return data

    def read_headers(self) -> List[str]:
        if self._headers is not None:
            return self._headers
        data_list = self._get_iterable()
        if not data_list or not isinstance(data_list[0], dict):
            self._headers = []
            return self._headers
        self._headers = list(data_list[0].keys())
        return self._headers

    def read_rows(
        self,
        start: int = 0,
        batch_size: Optional[int] = None,
    ) -> Iterator[Record]:
        data_list = self._get_iterable()
        headers = self.read_headers()
        row_index = 0
        yielded = 0
        for item in data_list:
            if row_index < start:
                row_index += 1
                continue
            if not isinstance(item, dict):
                row_index += 1
                continue
            data = {}
            for h in headers:
                val = item.get(h)
                if val is not None and not isinstance(val, (str, int, float, bool)):
                    val = json.dumps(val, ensure_ascii=False)
                data[h] = val
            if self._kwargs.get("skip_empty_rows", True):
                if all(v is None or v == "" for v in data.values()):
                    row_index += 1
                    continue
            yield Record(row_index=row_index, data=data)
            row_index += 1
            yielded += 1
            if batch_size is not None and yielded >= batch_size:
                break

    def total_rows(self) -> int:
        if self._total is not None:
            return self._total
        data_list = self._get_iterable()
        self._total = len(data_list) if isinstance(data_list, list) else 0
        return self._total
