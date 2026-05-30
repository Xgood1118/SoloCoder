from __future__ import annotations

import csv
import io
import os
from typing import Dict, Iterator, List, Optional

from data_io.reader.base import BaseReader
from data_io.models import Record
from data_io.utils.encoding import detect_encoding


class CsvReader(BaseReader):
    def __init__(
        self,
        file_path: str,
        encoding: Optional[str] = None,
        delimiter: str = ",",
        quotechar: str = '"',
        **kwargs,
    ):
        super().__init__(file_path, encoding, **kwargs)
        self.delimiter = delimiter
        self.quotechar = quotechar
        self._encoding = encoding or detect_encoding(file_path)
        self._headers: Optional[List[str]] = None
        self._total: Optional[int] = None

    def read_headers(self) -> List[str]:
        if self._headers is not None:
            return self._headers
        with open(self.file_path, "r", encoding=self._encoding, newline="") as f:
            sample = f.read(8192)
            sniffed = csv.Sniffer().sniff(sample, delimiters=",\t;|")
            if sniffed.delimiter:
                self.delimiter = sniffed.delimiter
            f.seek(0)
            reader = csv.reader(f, delimiter=self.delimiter, quotechar=self.quotechar)
            self._headers = [h.strip() for h in next(reader)]
        return self._headers

    def read_rows(
        self,
        start: int = 0,
        batch_size: Optional[int] = None,
    ) -> Iterator[Record]:
        headers = self.read_headers()
        with open(self.file_path, "r", encoding=self._encoding, newline="") as f:
            reader = csv.reader(f, delimiter=self.delimiter, quotechar=self.quotechar)
            next(reader, None)
            row_index = 0
            yielded = 0
            for row in reader:
                if row_index < start:
                    row_index += 1
                    continue
                data = {}
                for i, header in enumerate(headers):
                    if i < len(row):
                        val = row[i].strip() if row[i] else None
                        data[header] = val
                    else:
                        data[header] = None
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
        count = 0
        with open(self.file_path, "r", encoding=self._encoding, newline="") as f:
            reader = csv.reader(f, delimiter=self.delimiter, quotechar=self.quotechar)
            next(reader, None)
            for _ in reader:
                count += 1
        self._total = count
        return count
