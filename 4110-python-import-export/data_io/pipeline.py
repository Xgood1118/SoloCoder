from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from data_io.models import (
    Record,
    RecordStatus,
    ValidationResult,
    Checkpoint,
    FieldMapping,
)
from data_io.reader.base import BaseReader
from data_io.writer.base import BaseWriter
from data_io.validator import Validator
from data_io.mapper import Mapper
from data_io.progress import ProgressTracker
from data_io.utils.desensitize import desensitize_data
from data_io.utils.splitter import generate_file_splits


class PipelineResult:
    def __init__(self):
        self.total_records: int = 0
        self.processed_records: int = 0
        self.succeeded_records: int = 0
        self.failed_records: int = 0
        self.skipped_records: int = 0
        self.errors: List[Dict[str, Any]] = []
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.output_files: List[str] = []

    @property
    def duration(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_records": self.total_records,
            "processed_records": self.processed_records,
            "succeeded_records": self.succeeded_records,
            "failed_records": self.failed_records,
            "skipped_records": self.skipped_records,
            "error_count": len(self.errors),
            "sample_errors": self.errors[:10],
            "duration_seconds": self.duration,
            "output_files": self.output_files,
        }

    def generate_error_report(self, file_path: str) -> None:
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": self.to_dict(),
            "errors": self.errors,
        }
        os.makedirs(os.path.dirname(file_path) or ".", exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)


class Pipeline:
    def __init__(
        self,
        reader: Optional[BaseReader] = None,
        writer: Optional[BaseWriter] = None,
        validator: Optional[Validator] = None,
        mapper: Optional[Mapper] = None,
        enable_desensitization: bool = False,
        desensitize_fields: Optional[List[str]] = None,
        stop_on_error: bool = False,
        checkpoint_path: Optional[str] = None,
    ):
        self.reader = reader
        self.writer = writer
        self.validator = validator or Validator()
        self.mapper = mapper or Mapper()
        self.enable_desensitization = enable_desensitization
        self.desensitize_fields = desensitize_fields or []
        self.stop_on_error = stop_on_error
        self.checkpoint_path = checkpoint_path
        self.progress = ProgressTracker()
        self._checkpoint: Optional[Checkpoint] = None
        self._pre_process_hooks: List[Callable[[Record], Record]] = []
        self._post_process_hooks: List[Callable[[Record], Record]] = []
        self._is_paused = False

    def add_pre_process_hook(self, hook: Callable[[Record], Record]) -> None:
        self._pre_process_hooks.append(hook)

    def add_post_process_hook(self, hook: Callable[[Record], Record]) -> None:
        self._post_process_hooks.append(hook)

    def _load_checkpoint(self) -> Optional[Checkpoint]:
        if not self.checkpoint_path or not os.path.exists(self.checkpoint_path):
            return None
        try:
            with open(self.checkpoint_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return Checkpoint(
                row_index=data["row_index"],
                timestamp=datetime.fromisoformat(data["timestamp"]),
                batch_index=data["batch_index"],
                metadata=data.get("metadata", {}),
            )
        except Exception:
            return None

    def _save_checkpoint(self, row_index: int, batch_index: int, **kwargs) -> None:
        if not self.checkpoint_path:
            return
        checkpoint = Checkpoint(
            row_index=row_index,
            timestamp=datetime.now(),
            batch_index=batch_index,
            metadata=kwargs,
        )
        os.makedirs(os.path.dirname(self.checkpoint_path) or ".", exist_ok=True)
        with open(self.checkpoint_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "row_index": checkpoint.row_index,
                    "timestamp": checkpoint.timestamp.isoformat(),
                    "batch_index": checkpoint.batch_index,
                    "metadata": checkpoint.metadata,
                },
                f,
                ensure_ascii=False,
            )

    def pause(self) -> None:
        self._is_paused = True

    def resume(self) -> None:
        self._is_paused = False

    def run(
        self,
        batch_size: int = 1000,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> PipelineResult:
        if self.reader is None or self.writer is None:
            raise ValueError("Reader and Writer must be set")

        result = PipelineResult()
        result.start_time = datetime.now()

        checkpoint = self._load_checkpoint()
        start_row = checkpoint.row_index if checkpoint else 0

        total_rows = self.reader.total_rows()
        result.total_records = total_rows
        self.progress.start(total_rows)

        if progress_callback:
            self.progress.subscribe(lambda info: progress_callback({
                "total": info.total,
                "processed": info.processed,
                "percent": info.progress_percent,
                "eta": info.estimated_end.isoformat() if info.estimated_end else None,
            }))

        if self.mapper.mappings:
            self.writer.headers = self.mapper.get_target_fields()
        else:
            self.writer.headers = self.reader.read_headers()

        batch_index = 0
        processed_count = 0
        succeeded_count = 0
        failed_count = 0
        skipped_count = 0

        try:
            for batch_start in range(start_row, total_rows, batch_size):
                if self._is_paused:
                    self._save_checkpoint(batch_start, batch_index)
                    break

                batch = self.reader.read_batch(batch_start, batch_size)

                for record in batch:
                    record.status = RecordStatus.PROCESSING

                    for hook in self._pre_process_hooks:
                        record = hook(record)

                    if self.validator.rules:
                        validation_result = self.validator.validate_record(record)
                        if not validation_result.is_valid:
                            record.status = RecordStatus.FAILED
                            record.errors.extend(validation_result.errors)
                            failed_count += 1
                            for err in validation_result.errors:
                                result.errors.append({
                                    "row": record.row_index,
                                    "field": err.field_name,
                                    "message": err.message,
                                    "value": err.value,
                                })
                            if self.stop_on_error:
                                raise ValueError(f"Validation error at row {record.row_index}")
                            processed_count += 1
                            continue

                    mapped_data = self.mapper.map_record(record)

                    if self.enable_desensitization:
                        mapped_data = desensitize_data(mapped_data, self.desensitize_fields)

                    for hook in self._post_process_hooks:
                        record.data = mapped_data
                        record = hook(record)
                        mapped_data = record.data

                    self.writer.write_row(mapped_data)
                    record.status = RecordStatus.SUCCESS
                    succeeded_count += 1
                    processed_count += 1

                    self.progress.update(
                        processed=processed_count,
                        succeeded=succeeded_count,
                        failed=failed_count,
                        skipped=skipped_count,
                    )

                batch_index += 1
                self._save_checkpoint(batch_start + batch_size, batch_index)

        except Exception as e:
            self._save_checkpoint(batch_start, batch_index, error=str(e))
            raise

        finally:
            self.writer.close()

        result.processed_records = processed_count
        result.succeeded_records = succeeded_count
        result.failed_records = failed_count
        result.skipped_records = skipped_count
        result.end_time = datetime.now()
        result.output_files = [self.writer.file_path]

        if self.checkpoint_path and os.path.exists(self.checkpoint_path):
            os.remove(self.checkpoint_path)

        return result

    def run_split(
        self,
        max_rows_per_file: int,
        batch_size: int = 1000,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> PipelineResult:
        if self.reader is None:
            raise ValueError("Reader must be set")

        total_rows = self.reader.total_rows()
        splits = generate_file_splits(
            self.writer.file_path if self.writer else "output",
            total_rows,
            max_rows_per_file,
        )

        result = PipelineResult()
        result.start_time = datetime.now()
        result.total_records = total_rows

        base_writer = self.writer
        all_outputs = []

        for i, (file_path, start, end) in enumerate(splits):
            writer_kwargs = {
                "file_path": file_path,
                "headers": self.reader.read_headers(),
            }
            if base_writer:
                from data_io.writer import get_writer
                writer = get_writer(file_path, **writer_kwargs)
            else:
                from data_io.writer import CsvWriter
                writer = CsvWriter(**writer_kwargs)

            self.writer = writer
            sub_result = self.run(batch_size, progress_callback)
            all_outputs.append(file_path)

            result.processed_records += sub_result.processed_records
            result.succeeded_records += sub_result.succeeded_records
            result.failed_records += sub_result.failed_records
            result.skipped_records += sub_result.skipped_records
            result.errors.extend(sub_result.errors)

        result.end_time = datetime.now()
        result.output_files = all_outputs
        return result

    def preview(self, count: int = 5) -> List[Dict[str, Any]]:
        if self.reader is None:
            raise ValueError("Reader must be set")

        records = self.reader.preview(count)
        preview_data = []

        for record in records:
            if self.validator.rules:
                validation_result = self.validator.validate_record(record)
                valid = validation_result.is_valid
                errors = [e.message for e in validation_result.errors]
            else:
                valid = True
                errors = []

            mapped = self.mapper.map_record(record)

            if self.enable_desensitization:
                mapped = desensitize_data(mapped, self.desensitize_fields)

            preview_data.append({
                "row_index": record.row_index,
                "original": record.original_data,
                "mapped": mapped,
                "valid": valid,
                "errors": errors,
            })

        return preview_data
