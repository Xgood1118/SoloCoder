"""
报告生成模块
生成同步和备份操作的详细报告
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime
import json
import os


@dataclass
class FileSyncResult:
    file_path: str
    target_path: str
    success: bool
    skipped: bool = False
    skip_reason: str = ""
    original_size: int = 0
    compressed_size: int = 0
    upload_time: float = 0.0
    error_message: str = ""


@dataclass
class SyncReport:
    task_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    files_synced: int = 0
    files_skipped: int = 0
    files_failed: int = 0
    total_data_uploaded: int = 0
    total_original_size: int = 0
    results: List[FileSyncResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def add_result(self, result: FileSyncResult):
        self.results.append(result)
        if result.skipped:
            self.files_skipped += 1
        elif result.success:
            self.files_synced += 1
            self.total_data_uploaded += result.compressed_size if result.compressed_size > 0 else result.original_size
            self.total_original_size += result.original_size
        else:
            self.files_failed += 1
            if result.error_message:
                self.errors.append(f"{result.file_path}: {result.error_message}")

    def complete(self):
        self.end_time = datetime.now()

    @property
    def duration(self) -> float:
        if self.end_time and self.start_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0

    @property
    def compression_ratio(self) -> float:
        if self.total_original_size > 0 and self.total_data_uploaded > 0:
            return self.total_data_uploaded / self.total_original_size
        return 1.0

    def to_dict(self) -> Dict:
        return {
            "task_name": self.task_name,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration,
            "files_synced": self.files_synced,
            "files_skipped": self.files_skipped,
            "files_failed": self.files_failed,
            "total_data_uploaded_bytes": self.total_data_uploaded,
            "total_original_size_bytes": self.total_original_size,
            "compression_ratio": round(self.compression_ratio, 4),
            "errors": self.errors,
            "results": [
                {
                    "file_path": r.file_path,
                    "target_path": r.target_path,
                    "success": r.success,
                    "skipped": r.skipped,
                    "skip_reason": r.skip_reason,
                    "original_size": r.original_size,
                    "compressed_size": r.compressed_size,
                    "upload_time": r.upload_time,
                    "error_message": r.error_message
                }
                for r in self.results
            ]
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    def to_summary(self) -> str:
        lines = [
            "=" * 60,
            f"同步任务报告 - {self.task_name}",
            "=" * 60,
            f"开始时间: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"结束时间: {self.end_time.strftime('%Y-%m-%d %H:%M:%S') if self.end_time else '未完成'}",
            f"持续时间: {self.duration:.2f} 秒",
            "-" * 60,
            f"同步成功: {self.files_synced} 个文件",
            f"跳过文件: {self.files_skipped} 个文件",
            f"同步失败: {self.files_failed} 个文件",
            f"上传数据量: {self._format_size(self.total_data_uploaded)}",
            f"原始数据量: {self._format_size(self.total_original_size)}",
            f"压缩比: {self.compression_ratio:.2%}",
            "-" * 60,
        ]

        if self.errors:
            lines.append("错误信息:")
            for error in self.errors[:10]:
                lines.append(f"  - {error}")
            if len(self.errors) > 10:
                lines.append(f"  ... 还有 {len(self.errors) - 10} 个错误")
            lines.append("-" * 60)

        if self.files_skipped > 0:
            lines.append("跳过的文件:")
            skipped = [r for r in self.results if r.skipped]
            for result in skipped[:5]:
                lines.append(f"  - {result.file_path}: {result.skip_reason}")
            if len(skipped) > 5:
                lines.append(f"  ... 还有 {len(skipped) - 5} 个跳过的文件")
            lines.append("-" * 60)

        return "\n".join(lines)

    @staticmethod
    def _format_size(size_bytes: int) -> str:
        if size_bytes == 0:
            return "0 B"
        units = ['B', 'KB', 'MB', 'GB', 'TB']
        import math
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {units[i]}"


class ReportManager:
    def __init__(self, report_dir: str = "./reports"):
        self.report_dir = report_dir
        os.makedirs(report_dir, exist_ok=True)

    def save_report(self, report: SyncReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{report.task_name}_{timestamp}.json"
        filepath = os.path.join(self.report_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report.to_json())

        return filepath

    def save_summary(self, report: SyncReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{report.task_name}_{timestamp}_summary.txt"
        filepath = os.path.join(self.report_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report.to_summary())

        return filepath
