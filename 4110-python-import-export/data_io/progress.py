from __future__ import annotations

import time
from datetime import datetime
from typing import Callable, List, Optional

from data_io.models import ProgressInfo


class ProgressTracker:
    def __init__(self, total: int = 0):
        self._info = ProgressInfo(total=total)
        self._subscribers: List[Callable[[ProgressInfo], None]] = []
        self._start_time: Optional[float] = None
        self._last_update: float = 0
        self._update_interval: float = 0.1

    def subscribe(self, callback: Callable[[ProgressInfo], None]) -> None:
        self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[ProgressInfo], None]) -> None:
        if callback in self._subscribers:
            self._subscribers.remove(callback)

    def _notify(self) -> None:
        for callback in self._subscribers:
            try:
                callback(self._info)
            except Exception:
                pass

    def start(self, total: Optional[int] = None) -> None:
        if total is not None:
            self._info.total = total
        self._info.started_at = datetime.now()
        self._start_time = time.time()
        self._notify()

    def update(
        self,
        processed: Optional[int] = None,
        succeeded: Optional[int] = None,
        failed: Optional[int] = None,
        skipped: Optional[int] = None,
        force: bool = False,
    ) -> None:
        if processed is not None:
            self._info.processed = processed
        if succeeded is not None:
            self._info.succeeded = succeeded
        if failed is not None:
            self._info.failed = failed
        if skipped is not None:
            self._info.skipped = skipped
        now = time.time()
        if self._start_time and self._info.processed > 0:
            elapsed = now - self._start_time
            rate = self._info.processed / elapsed
            remaining_count = self._info.total - self._info.processed
            if rate > 0:
                eta_seconds = remaining_count / rate
                self._info.estimated_end = datetime.fromtimestamp(now + eta_seconds)
        if force or (now - self._last_update) >= self._update_interval:
            self._last_update = now
            self._notify()

    def increment(
        self,
        delta_processed: int = 1,
        delta_succeeded: int = 0,
        delta_failed: int = 0,
        delta_skipped: int = 0,
    ) -> None:
        self.update(
            processed=self._info.processed + delta_processed,
            succeeded=self._info.succeeded + delta_succeeded,
            failed=self._info.failed + delta_failed,
            skipped=self._info.skipped + delta_skipped,
        )

    def finish(self) -> None:
        self.update(processed=self._info.total, force=True)

    def reset(self) -> None:
        self._info = ProgressInfo()
        self._start_time = None
        self._last_update = 0

    @property
    def info(self) -> ProgressInfo:
        return self._info

    @property
    def progress_ratio(self) -> float:
        return self._info.progress_ratio

    @property
    def progress_percent(self) -> float:
        return self._info.progress_percent

    def get_eta(self) -> Optional[float]:
        if self._info.estimated_end and self._info.started_at:
            return (self._info.estimated_end - datetime.now()).total_seconds()
        return None

    def get_rate(self) -> float:
        if self._start_time is None:
            return 0
        elapsed = time.time() - self._start_time
        if elapsed <= 0:
            return 0
        return self._info.processed / elapsed
