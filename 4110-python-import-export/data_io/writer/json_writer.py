from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from data_io.writer.base import BaseWriter
from data_io.utils.helpers import ensure_dir


class JsonWriter(BaseWriter):
    def __init__(
        self,
        file_path: str,
        headers: Optional[List[str]] = None,
        encoding: str = "utf-8",
        indent: Optional[int] = 2,
        ensure_ascii: bool = False,
        append: bool = False,
        json_path: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(file_path, headers, encoding, **kwargs)
        self.indent = indent
        self.ensure_ascii = ensure_ascii
        self.append = append
        self.json_path = json_path
        self._data: List[Dict[str, Any]] = []

    def _init_writer(self) -> None:
        ensure_dir(self.file_path)
        if self.append:
            import os
            if os.path.exists(self.file_path) and os.path.getsize(self.file_path) > 0:
                try:
                    with open(self.file_path, "r", encoding=self.encoding) as f:
                        existing = json.load(f)
                        if isinstance(existing, list):
                            self._data = existing
                except (json.JSONDecodeError, FileNotFoundError):
                    pass

    def _write_header(self) -> None:
        pass

    def _write_row(self, data: Dict[str, Any]) -> None:
        if not self.headers:
            self.headers = list(data.keys())
        filtered = {}
        for h in self.headers:
            filtered[h] = data.get(h)
        self._data.append(filtered)

    def _finalize(self) -> None:
        output = self._data
        if self.json_path:
            parts = self.json_path.split(".")
            root = output
            for p in reversed(parts):
                root = {p: root}
            output = root
        with open(self.file_path, "w", encoding=self.encoding) as f:
            json.dump(
                output,
                f,
                indent=self.indent,
                ensure_ascii=self.ensure_ascii,
            )


class JsonLinesWriter(BaseWriter):
    def __init__(
        self,
        file_path: str,
        headers: Optional[List[str]] = None,
        encoding: str = "utf-8",
        ensure_ascii: bool = False,
        append: bool = False,
        **kwargs,
    ):
        super().__init__(file_path, headers, encoding, **kwargs)
        self.ensure_ascii = ensure_ascii
        self.append = append
        self._file = None

    def _init_writer(self) -> None:
        ensure_dir(self.file_path)
        mode = "a" if self.append else "w"
        self._file = open(self.file_path, mode, encoding=self.encoding)

    def _write_header(self) -> None:
        pass

    def _write_row(self, data: Dict[str, Any]) -> None:
        if not self.headers:
            self.headers = list(data.keys())
        filtered = {}
        for h in self.headers:
            filtered[h] = data.get(h)
        line = json.dumps(filtered, ensure_ascii=self.ensure_ascii)
        self._file.write(line + "\n")

    def _finalize(self) -> None:
        if self._file:
            self._file.close()

    def flush(self) -> None:
        if self._file:
            self._file.flush()
