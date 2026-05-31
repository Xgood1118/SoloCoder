import json
from functools import lru_cache
from typing import Any, Optional

import redis

from crm_sync.config import get_settings


class RedisClient:
    def __init__(self, url: str, password: Optional[str] = None):
        self._client = redis.Redis.from_url(
            url,
            password=password,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
        )

    def get(self, key: str) -> Optional[str]:
        return self._client.get(key)

    def set(self, key: str, value: Any, expire: Optional[int] = None) -> None:
        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False)
        self._client.set(key, value, ex=expire)

    def delete(self, key: str) -> None:
        self._client.delete(key)

    def exists(self, key: str) -> bool:
        return bool(self._client.exists(key))

    def get_json(self, key: str) -> Optional[Any]:
        value = self.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return None

    def acquire_lock(self, lock_key: str, timeout: int = 60) -> bool:
        return bool(
            self._client.set(lock_key, "locked", nx=True, ex=timeout)
        )

    def release_lock(self, lock_key: str) -> None:
        self.delete(lock_key)

    def incr(self, key: str) -> int:
        return self._client.incr(key)

    def hset(self, name: str, key: str, value: Any) -> None:
        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False)
        self._client.hset(name, key, value)

    def hget(self, name: str, key: str) -> Optional[str]:
        return self._client.hget(name, key)

    def hgetall(self, name: str) -> dict:
        return self._client.hgetall(name)

    def lpush(self, key: str, *values: Any) -> None:
        self._client.lpush(key, *values)

    def rpop(self, key: str) -> Optional[str]:
        return self._client.rpop(key)

    def brpop(self, key: str, timeout: int = 0) -> Optional[tuple]:
        return self._client.brpop(key, timeout=timeout)

    def ping(self) -> bool:
        try:
            return self._client.ping()
        except redis.ConnectionError:
            return False

    @property
    def client(self) -> redis.Redis:
        return self._client


@lru_cache()
def get_redis_client() -> RedisClient:
    settings = get_settings()
    return RedisClient(settings.redis.url, settings.redis.password)
