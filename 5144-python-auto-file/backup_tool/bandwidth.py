"""
带宽限制模块
动态控制上传速度，防止占用过多网络带宽
"""

import io
import time
import threading
from collections import deque
from typing import Optional, BinaryIO
from .logger import get_logger

logger = get_logger("bandwidth")


class BandwidthLimiter:
    def __init__(self, max_bandwidth_mb_per_sec: float = 0):
        self.max_bandwidth = max_bandwidth_mb_per_sec * 1024 * 1024
        self._bytes_transferred = 0
        self._start_time = time.time()
        self._window_start = time.time()
        self._window_bytes = 0
        self._lock = threading.Lock()
        self._speed_history = deque(maxlen=10)
        self._last_check = time.time()

        if max_bandwidth_mb_per_sec > 0:
            logger.info(f"带宽限制已启用: {max_bandwidth_mb_per_sec} MB/s")
        else:
            logger.info("带宽限制未启用")

    @property
    def enabled(self) -> bool:
        return self.max_bandwidth > 0

    @property
    def current_speed(self) -> float:
        with self._lock:
            elapsed = time.time() - self._window_start
            if elapsed > 0:
                return self._window_bytes / elapsed
            return 0.0

    @property
    def average_speed(self) -> float:
        with self._lock:
            elapsed = time.time() - self._start_time
            if elapsed > 0:
                return self._bytes_transferred / elapsed
            return 0.0

    @property
    def total_transferred(self) -> int:
        return self._bytes_transferred

    def _check_and_wait(self, bytes_to_send: int):
        if not self.enabled:
            return

        with self._lock:
            now = time.time()
            elapsed = now - self._last_check

            if elapsed >= 1.0:
                current_speed = self._window_bytes / elapsed if elapsed > 0 else 0

                if current_speed > self.max_bandwidth:
                    excess = self._window_bytes - (self.max_bandwidth * elapsed)
                    wait_time = excess / self.max_bandwidth

                    if wait_time > 0:
                        logger.debug(
                            f"带宽超限: 当前 {current_speed/1024/1024:.2f} MB/s, "
                            f"限制 {self.max_bandwidth/1024/1024:.2f} MB/s, "
                            f"等待 {wait_time:.2f}s"
                        )
                        time.sleep(wait_time)

                self._speed_history.append(current_speed)
                self._window_start = time.time()
                self._window_bytes = 0
                self._last_check = time.time()

            projected_end = self._window_bytes + bytes_to_send
            projected_elapsed = time.time() - self._window_start + 0.001

            if projected_end / projected_elapsed > self.max_bandwidth and projected_elapsed > 0.1:
                allowed = self.max_bandwidth * projected_elapsed - self._window_bytes
                if allowed < bytes_to_send:
                    needed = bytes_to_send - allowed
                    wait_time = needed / self.max_bandwidth
                    if wait_time > 0.01:
                        logger.debug(f"预等待 {wait_time:.3f}s 以控制带宽")
                        time.sleep(wait_time)
                        self._window_start = time.time()
                        self._window_bytes = 0

    def record_transfer(self, bytes_transferred: int):
        with self._lock:
            self._bytes_transferred += bytes_transferred
            self._window_bytes += bytes_transferred

    def wrap_fileobj(self, fileobj: BinaryIO) -> 'BandwidthLimitedFileObj':
        return BandwidthLimitedFileObj(fileobj, self)

    def wrap_data(self, data: bytes) -> bytes:
        if not self.enabled:
            return data

        chunk_size = min(8192, max(1024, int(self.max_bandwidth / 10)))
        offset = 0
        total = len(data)

        while offset < total:
            chunk_end = min(offset + chunk_size, total)
            chunk = data[offset:chunk_end]
            chunk_len = len(chunk)

            self._check_and_wait(chunk_len)
            self.record_transfer(chunk_len)

            offset = chunk_end

        return data

    def reset(self):
        with self._lock:
            self._bytes_transferred = 0
            self._start_time = time.time()
            self._window_start = time.time()
            self._window_bytes = 0
            self._last_check = time.time()
            self._speed_history.clear()


class BandwidthLimitedFileObj:
    def __init__(self, fileobj: BinaryIO, limiter: BandwidthLimiter):
        self._fileobj = fileobj
        self._limiter = limiter
        self._closed = False

    def read(self, size: int = -1) -> bytes:
        if self._closed:
            raise ValueError("I/O operation on closed file")

        if size < 0:
            data = self._fileobj.read()
            if self._limiter.enabled and data:
                self._limiter.wrap_data(data)
            return data

        chunk_size = size
        if self._limiter.enabled:
            max_chunk = min(8192, max(1024, int(self._limiter.max_bandwidth / 10)))
            chunk_size = min(size, max_chunk)

        self._limiter._check_and_wait(chunk_size)
        data = self._fileobj.read(chunk_size)

        if data:
            self._limiter.record_transfer(len(data))

        return data

    def seek(self, offset: int, whence: int = 0) -> int:
        return self._fileobj.seek(offset, whence)

    def tell(self) -> int:
        return self._fileobj.tell()

    def close(self):
        if not self._closed:
            self._fileobj.close()
            self._closed = True

    @property
    def closed(self) -> bool:
        return self._closed

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    def __iter__(self):
        return self

    def __next__(self) -> bytes:
        line = self.readline()
        if not line:
            raise StopIteration
        return line

    def readline(self, size: int = -1) -> bytes:
        data = self._fileobj.readline(size)
        if data and self._limiter.enabled:
            self._limiter._check_and_wait(len(data))
            self._limiter.record_transfer(len(data))
        return data


class GlobalBandwidthManager:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._task_limiters: dict[str, BandwidthLimiter] = {}
        self._lock = threading.Lock()

    def get_task_limiter(self, task_name: str, max_bandwidth: float = 0) -> BandwidthLimiter:
        with self._lock:
            if task_name not in self._task_limiters:
                self._task_limiters[task_name] = BandwidthLimiter(max_bandwidth)
            return self._task_limiters[task_name]

    def remove_task_limiter(self, task_name: str):
        with self._lock:
            if task_name in self._task_limiters:
                del self._task_limiters[task_name]

    def get_total_speed(self) -> float:
        with self._lock:
            return sum(limiter.current_speed for limiter in self._task_limiters.values())

    def get_statistics(self) -> dict:
        with self._lock:
            stats = {}
            for task_name, limiter in self._task_limiters.items():
                stats[task_name] = {
                    "current_speed_mb_s": limiter.current_speed / 1024 / 1024,
                    "average_speed_mb_s": limiter.average_speed / 1024 / 1024,
                    "total_transferred_mb": limiter.total_transferred / 1024 / 1024,
                    "limit_mb_s": limiter.max_bandwidth / 1024 / 1024 if limiter.enabled else 0
                }
            return stats


def get_global_bandwidth_manager() -> GlobalBandwidthManager:
    return GlobalBandwidthManager()
