import re
import threading


class RegexCache:
    _instance = None
    _lock = threading.Lock()

    def __init__(self, max_size=256):
        self._cache = {}
        self._max_size = max_size
        self._access_order = []

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def get(self, pattern, flags=0):
        key = (pattern, flags)
        if key in self._cache:
            if key in self._access_order:
                self._access_order.remove(key)
            self._access_order.append(key)
            return self._cache[key]

        compiled = re.compile(pattern, flags)
        self._cache[key] = compiled
        self._access_order.append(key)

        if len(self._cache) > self._max_size:
            oldest_key = self._access_order.pop(0)
            del self._cache[oldest_key]

        return compiled

    def clear(self):
        self._cache.clear()
        self._access_order.clear()

    def size(self):
        return len(self._cache)

    @classmethod
    def reset(cls):
        with cls._lock:
            cls._instance = None
