from __future__ import annotations

import asyncio
import json
import logging
import random
import uuid
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional

from pythonjsonlogger import jsonlogger


def setup_logging(name: str = "mq_broker", level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(level)

    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s %(module)s %(funcName)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


logger = setup_logging()


def generate_message_id() -> str:
    return str(uuid.uuid4())


def serialize_message(body: Any, content_type: str = "application/json") -> bytes:
    if isinstance(body, bytes):
        return body
    if isinstance(body, str):
        return body.encode("utf-8")
    if content_type == "application/json":
        return json.dumps(body).encode("utf-8")
    return str(body).encode("utf-8")


def deserialize_message(body: bytes, content_type: str = "application/json") -> Any:
    if content_type == "application/json":
        try:
            return json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return body
    return body


def calculate_exponential_backoff(
    retry_count: int,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    multiplier: float = 2.0,
    jitter: bool = True,
) -> float:
    delay = initial_delay * (multiplier ** retry_count)
    delay = min(delay, max_delay)
    if jitter:
        delay = delay * (0.5 + random.random())
    return delay


class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout_seconds: int = 30,
    ):
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout_seconds = timeout_seconds
        self.failure_count = 0
        self.success_count = 0
        self.state = "closed"
        self.last_failure_time: Optional[datetime] = None

    def call(self, func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if self.state == "open":
                if (
                    self.last_failure_time
                    and (datetime.now() - self.last_failure_time).total_seconds()
                    > self.timeout_seconds
                ):
                    self.state = "half_open"
                    self.success_count = 0
                else:
                    raise CircuitBreakerOpen("Circuit breaker is open")

            try:
                result = await func(*args, **kwargs)
                self._on_success()
                return result
            except Exception as e:
                self._on_failure()
                raise e

        return wrapper

    def _on_success(self):
        if self.state == "half_open":
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = "closed"
                self.failure_count = 0
        else:
            self.failure_count = 0

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        if self.state == "half_open" or self.failure_count >= self.failure_threshold:
            self.state = "open"


class CircuitBreakerOpen(Exception):
    pass


class ConcurrentLimiter:
    def __init__(self, max_concurrent: int = 1000):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.max_concurrent = max_concurrent

    async def acquire(self):
        await self.semaphore.acquire()

    def release(self):
        self.semaphore.release()

    async def __aenter__(self):
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.release()
        return False

    def is_full(self) -> bool:
        return self.semaphore._value == 0


class MessageBuffer:
    def __init__(self, max_size: int = 10000, overflow_strategy: str = "block"):
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=max_size)
        self.max_size = max_size
        self.overflow_strategy = overflow_strategy

    async def put(self, message: Any, timeout: Optional[float] = None) -> bool:
        try:
            if self.overflow_strategy == "drop" and self.queue.full():
                logger.warning("Buffer full, dropping message")
                return False

            if timeout:
                await asyncio.wait_for(self.queue.put(message), timeout=timeout)
            else:
                await self.queue.put(message)
            return True
        except asyncio.TimeoutError:
            logger.warning("Buffer put timeout")
            return False

    async def get(self, timeout: Optional[float] = None) -> Optional[Any]:
        try:
            if timeout:
                return await asyncio.wait_for(self.queue.get(), timeout=timeout)
            return await self.queue.get()
        except asyncio.TimeoutError:
            return None

    def qsize(self) -> int:
        return self.queue.qsize()

    def is_empty(self) -> bool:
        return self.queue.empty()

    def is_full(self) -> bool:
        return self.queue.full()


class FilterEngine:
    def __init__(self, filter_expression: Optional[str] = None):
        self.filter_expression = filter_expression

    def matches(self, headers: Dict[str, Any]) -> bool:
        if not self.filter_expression:
            return True
        try:
            return eval(self.filter_expression, {"headers": headers})
        except Exception as e:
            logger.error(f"Filter evaluation error: {e}")
            return True
