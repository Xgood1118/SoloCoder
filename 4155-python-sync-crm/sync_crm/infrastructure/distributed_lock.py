"""
分布式锁
基于Redis实现分布式锁，防止并发同步冲突
"""
import time
import uuid
import threading
from contextlib import contextmanager
from typing import Optional, Generator

import redis

from sync_crm.config import settings
from sync_crm.infrastructure.logging import get_logger

logger = get_logger(__name__)


class DistributedLock:
    """Redis分布式锁实现"""

    def __init__(
        self,
        redis_client: redis.Redis,
        lock_key: str,
        timeout: int = 3600,
        acquire_timeout: int = 10,
    ):
        """
        初始化分布式锁

        Args:
            redis_client: Redis客户端
            lock_key: 锁的键名
            timeout: 锁超时时间(秒)
            acquire_timeout: 获取锁超时时间(秒)
        """
        self.redis = redis_client
        self.lock_key = f"lock:{lock_key}"
        self.timeout = timeout
        self.acquire_timeout = acquire_timeout
        self.lock_value: Optional[str] = None
        self._local = threading.local()

    def acquire(self) -> bool:
        """
        获取锁

        Returns:
            是否成功获取锁
        """
        if hasattr(self._local, "lock_count") and self._local.lock_count > 0:
            self._local.lock_count += 1
            return True

        self.lock_value = str(uuid.uuid4())
        start_time = time.time()

        while time.time() - start_time < self.acquire_timeout:
            if self.redis.set(
                self.lock_key,
                self.lock_value,
                ex=self.timeout,
                nx=True,
            ):
                self._local.lock_count = 1
                logger.debug(f"成功获取锁: {self.lock_key}")
                return True

            time.sleep(0.1)

        logger.warning(f"获取锁超时: {self.lock_key}")
        return False

    def release(self) -> None:
        """释放锁"""
        if hasattr(self._local, "lock_count") and self._local.lock_count > 1:
            self._local.lock_count -= 1
            return

        if self.lock_value is None:
            return

        try:
            script = """
                if redis.call("GET", KEYS[1]) == ARGV[1] then
                    return redis.call("DEL", KEYS[1])
                else
                    return 0
                end
            """
            result = self.redis.eval(script, 1, self.lock_key, self.lock_value)
            if result == 1:
                logger.debug(f"成功释放锁: {self.lock_key}")
            else:
                logger.warning(f"锁已过期或被其他进程持有: {self.lock_key}")
        finally:
            self.lock_value = None
            if hasattr(self._local, "lock_count"):
                delattr(self._local, "lock_count")

    def __enter__(self) -> "DistributedLock":
        if not self.acquire():
            raise RuntimeError(f"无法获取分布式锁: {self.lock_key}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.release()


_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    """获取Redis客户端（单例）"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=settings.redis.host,
            port=settings.redis.port,
            password=settings.redis.password or None,
            db=settings.redis.db,
            max_connections=settings.redis.max_connections,
            socket_timeout=settings.redis.socket_timeout,
            socket_connect_timeout=settings.redis.socket_connect_timeout,
            decode_responses=True,
        )
    return _redis_client


@contextmanager
def distributed_lock(
    lock_key: str,
    timeout: Optional[int] = None,
    acquire_timeout: int = 10,
) -> Generator[DistributedLock, None, None]:
    """
    分布式锁上下文管理器

    Args:
        lock_key: 锁的键名
        timeout: 锁超时时间(秒)，默认使用配置
        acquire_timeout: 获取锁超时时间(秒)

    Yields:
        分布式锁对象

    Raises:
        RuntimeError: 无法获取锁
    """
    if timeout is None:
        timeout = settings.sync.lock_timeout

    redis_client = get_redis_client()
    lock = DistributedLock(
        redis_client=redis_client,
        lock_key=lock_key,
        timeout=timeout,
        acquire_timeout=acquire_timeout,
    )

    if not lock.acquire():
        raise RuntimeError(f"无法获取分布式锁: {lock_key}")

    try:
        yield lock
    finally:
        lock.release()
