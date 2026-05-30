from __future__ import annotations

import os
from typing import Optional


def detect_encoding(file_path: str, sample_size: int = 10000) -> str:
    encodings = ["utf-8-sig", "utf-8", "gbk", "gb2312", "latin-1"]
    try:
        import chardet
        with open(file_path, "rb") as f:
            raw_data = f.read(sample_size)
        result = chardet.detect(raw_data)
        detected = result["encoding"]
        if detected:
            return detected
    except ImportError:
        pass
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                f.read(sample_size)
            return enc
        except UnicodeDecodeError:
            continue
    return "utf-8"
