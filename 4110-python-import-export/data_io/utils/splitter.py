from __future__ import annotations

import os
from typing import List, Tuple


def calculate_chunks(
    total_rows: int,
    max_rows_per_file: int,
) -> List[Tuple[int, int]]:
    if max_rows_per_file <= 0 or total_rows <= max_rows_per_file:
        return [(0, total_rows)]
    chunks = []
    start = 0
    while start < total_rows:
        end = min(start + max_rows_per_file, total_rows)
        chunks.append((start, end))
        start = end
    return chunks


def generate_file_splits(
    base_file_path: str,
    total_rows: int,
    max_rows_per_file: int,
) -> List[Tuple[str, int, int]]:
    chunks = calculate_chunks(total_rows, max_rows_per_file)
    if len(chunks) == 1:
        return [(base_file_path, 0, total_rows)]
    base, ext = os.path.splitext(base_file_path)
    result = []
    total_digits = len(str(len(chunks)))
    for i, (start, end) in enumerate(chunks):
        suffix = f"_part{i+1:0{total_digits}d}"
        result.append((f"{base}{suffix}{ext}", start, end))
    return result


def estimate_file_size(
    row_count: int,
    avg_bytes_per_row: int = 200,
    format: str = "csv",
) -> int:
    multipliers = {
        "csv": 1,
        "json": 1.5,
        "xml": 2.5,
        "xlsx": 0.8,
        "xls": 0.7,
    }
    multiplier = multipliers.get(format.lower(), 1)
    return int(row_count * avg_bytes_per_row * multiplier)


def suggest_batch_size(
    total_rows: int,
    max_memory_mb: int = 512,
    avg_bytes_per_row: int = 500,
) -> int:
    max_rows_in_memory = (max_memory_mb * 1024 * 1024) // avg_bytes_per_row
    if max_rows_in_memory >= total_rows:
        return total_rows
    return min(total_rows, max(max_rows_in_memory, 1000))
