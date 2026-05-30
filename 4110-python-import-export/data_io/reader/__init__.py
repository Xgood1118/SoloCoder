from __future__ import annotations

import os
from typing import Optional, Type

from data_io.reader.base import BaseReader
from data_io.reader.csv_reader import CsvReader
from data_io.reader.excel_reader import ExcelReader, XlsReader
from data_io.reader.json_reader import JsonReader
from data_io.reader.xml_reader import XmlReader


READER_REGISTRY = {
    ".csv": CsvReader,
    ".xlsx": ExcelReader,
    ".xlsm": ExcelReader,
    ".xls": XlsReader,
    ".json": JsonReader,
    ".xml": XmlReader,
}


def detect_format(file_path: str) -> Optional[str]:
    ext = os.path.splitext(file_path)[1].lower()
    if ext in READER_REGISTRY:
        return ext
    return None


def get_reader(
    file_path: str,
    format: Optional[str] = None,
    **kwargs,
) -> BaseReader:
    if format is None:
        format = detect_format(file_path)
    if format is None:
        raise ValueError(f"Could not detect format for file: {file_path}")
    if not format.startswith("."):
        format = "." + format.lower()
    reader_class = READER_REGISTRY.get(format)
    if reader_class is None:
        raise ValueError(f"No reader available for format: {format}")
    return reader_class(file_path=file_path, **kwargs)


__all__ = [
    "BaseReader",
    "CsvReader",
    "ExcelReader",
    "XlsReader",
    "JsonReader",
    "XmlReader",
    "get_reader",
    "detect_format",
]
