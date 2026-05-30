from __future__ import annotations

import os
from typing import Optional, Type

from data_io.writer.base import BaseWriter
from data_io.writer.csv_writer import CsvWriter
from data_io.writer.excel_writer import ExcelWriter
from data_io.writer.json_writer import JsonWriter, JsonLinesWriter
from data_io.writer.xml_writer import XmlWriter


WRITER_REGISTRY = {
    ".csv": CsvWriter,
    ".xlsx": ExcelWriter,
    ".xlsm": ExcelWriter,
    ".json": JsonWriter,
    ".jsonl": JsonLinesWriter,
    ".xml": XmlWriter,
}


def detect_format(file_path: str) -> Optional[str]:
    ext = os.path.splitext(file_path)[1].lower()
    if ext in WRITER_REGISTRY:
        return ext
    return None


def get_writer(
    file_path: str,
    format: Optional[str] = None,
    **kwargs,
) -> BaseWriter:
    if format is None:
        format = detect_format(file_path)
    if format is None:
        raise ValueError(f"Could not detect format for file: {file_path}")
    if not format.startswith("."):
        format = "." + format.lower()
    writer_class = WRITER_REGISTRY.get(format)
    if writer_class is None:
        raise ValueError(f"No writer available for format: {format}")
    return writer_class(file_path=file_path, **kwargs)


__all__ = [
    "BaseWriter",
    "CsvWriter",
    "ExcelWriter",
    "JsonWriter",
    "JsonLinesWriter",
    "XmlWriter",
    "get_writer",
    "detect_format",
]
