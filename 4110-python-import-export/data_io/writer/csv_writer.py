from __future__ import annotations

import csv
import os
from typing import Any, Dict, List, Optional

from data_io.writer.base import BaseWriter
from data_io.utils.helpers import ensure_dir


class CsvWriter(BaseWriter):
    def __init__(
        self,
        file_path: str,
        headers: Optional[List[str]] = None,
        encoding: str = "utf-8",
        delimiter: str = ",",
        quotechar: str = '"',
        add_bom: bool = True,
        append: bool = False,
        **kwargs,
    ):
        super().__init__(file_path, headers, encoding, **kwargs)
        self.delimiter = delimiter
        self.quotechar = quotechar
        self.add_bom = add_bom
        self.append = append
        self._file = None
        self._writer = None

    def _init_writer(self) -> None:
        ensure_dir(self.file_path)
        file_exists = os.path.exists(self.file_path) and os.path.getsize(self.file_path) > 0
        mode = "a" if self.append and file_exists else "w"
        if "b" in mode:
            mode = mode.replace("b", "")
        file_encoding = self.encoding
        if self.add_bom and file_encoding.lower() in ["utf-8", "utf8"]:
            file_encoding = "utf-8-sig"
        self._file = open(self.file_path, mode, encoding=file_encoding, newline="")
        self._writer = csv.writer(
            self._file,
            delimiter=self.delimiter,
            quotechar=self.quotechar,
            quoting=csv.QUOTE_MINIMAL,
        )

    def _write_header(self) -> None:
        if self.headers:
            if self.append and self._file:
                self._file.seek(0, 2)
                if self._file.tell() == 0:
                    self._writer.writerow(self.headers)
            else:
                self._writer.writerow(self.headers)

    def _write_row(self, data: Dict[str, Any]) -> None:
        if not self.headers:
            self.headers = list(data.keys())
        row = []
        for h in self.headers:
            val = data.get(h)
            if val is None:
                row.append("")
            else:
                row.append(str(val))
        self._writer.writerow(row)

    def _finalize(self) -> None:
        if self._file:
            self._file.close()
            self._file = None

    def flush(self) -> None:
        if self._file:
            self._file.flush()
