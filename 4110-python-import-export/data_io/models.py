from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple


class RecordStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class Record:
    row_index: int
    data: Dict[str, Any]
    status: RecordStatus = RecordStatus.PENDING
    errors: List[ValidationError] = field(default_factory=list)
    original_data: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.original_data is None:
            self.original_data = dict(self.data)


@dataclass
class ValidationError:
    row_index: int
    field_name: str
    rule_name: str
    message: str
    value: Any = None


@dataclass
class ValidationResult:
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)

    def add_error(self, error: ValidationError):
        self.errors.append(error)
        self.is_valid = False

    def merge(self, other: ValidationResult):
        self.errors.extend(other.errors)
        if not other.is_valid:
            self.is_valid = False


@dataclass
class ProgressInfo:
    total: int = 0
    processed: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0
    started_at: Optional[datetime] = None
    estimated_end: Optional[datetime] = None

    @property
    def progress_ratio(self) -> float:
        if self.total == 0:
            return 0.0
        return self.processed / self.total

    @property
    def progress_percent(self) -> float:
        return self.progress_ratio * 100

    @property
    def remaining(self) -> int:
        return max(0, self.total - self.processed)


@dataclass
class FieldMapping:
    source_field: str
    target_field: str
    transform: Optional[Callable[[Any], Any]] = None
    default: Any = None
    required: bool = False


@dataclass
class ImportConfig:
    file_path: str
    format: Optional[str] = None
    encoding: Optional[str] = None
    sheet_name: Optional[str] = None
    field_mappings: List[FieldMapping] = field(default_factory=list)
    skip_empty_rows: bool = True
    max_rows: Optional[int] = None
    start_row: int = 0
    batch_size: int = 1000
    enable_desensitization: bool = False
    desensitize_fields: List[str] = field(default_factory=list)


@dataclass
class ExportConfig:
    file_path: str
    format: Optional[str] = None
    encoding: str = "utf-8"
    sheet_name: str = "Sheet1"
    batch_size: int = 10000
    max_rows_per_file: Optional[int] = None
    csv_bom: bool = True
    json_indent: Optional[int] = 2
    excel_styles: bool = False
    field_mappings: List[FieldMapping] = field(default_factory=list)
    filters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DataSourceConfig:
    db_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    encrypted_password: Optional[str] = None
    query: Optional[str] = None
    table_name: Optional[str] = None
    api_url: Optional[str] = None
    api_headers: Dict[str, str] = field(default_factory=dict)
    api_params: Dict[str, str] = field(default_factory=dict)
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0


@dataclass
class Checkpoint:
    row_index: int
    timestamp: datetime
    batch_index: int
    metadata: Dict[str, Any] = field(default_factory=dict)
