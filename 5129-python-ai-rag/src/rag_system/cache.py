import json
import time
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from collections import OrderedDict

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    query: str
    query_hash: str
    results: List[Dict[str, Any]]
    created_at: float
    expires_at: float
    access_count: int
    last_accessed: float

    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CacheEntry":
        return cls(**data)


class QueryCache:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.cache_config = self.config.cache
        self.enabled = self.cache_config.enabled
        self.ttl = self.cache_config.ttl_seconds
        self.max_entries = self.cache_config.max_entries
        self.backend = self.cache_config.backend
        self.invalidate_on_update = self.cache_config.invalidate_on_update

        self.cache_dir = self.config.paths.cache_dir
        self.cache_file = self.cache_dir / "query_cache.json"
        self.index_file = self.cache_dir / "cache_index.json"

        self._cache: "OrderedDict[str, CacheEntry]" = OrderedDict()
        self._document_hashes: Dict[str, str] = {}

        if self.enabled:
            self._load_cache()
            self._load_document_hashes()

    def _load_cache(self) -> None:
        if not self.cache_file.exists():
            logger.info("No existing cache file found, starting with empty cache")
            return

        try:
            with open(self.cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            expired_count = 0
            for query_hash, entry_data in data.items():
                entry = CacheEntry.from_dict(entry_data)
                if entry.is_expired():
                    expired_count += 1
                    continue
                self._cache[query_hash] = entry

            logger.info(
                f"Loaded {len(self._cache)} cache entries, "
                f"skipped {expired_count} expired entries"
            )
        except Exception as e:
            logger.warning(f"Failed to load cache, starting fresh: {e}")
            self._cache = OrderedDict()

    def _save_cache(self) -> None:
        if not self.enabled:
            return

        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            data = {k: v.to_dict() for k, v in self._cache.items()}
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved {len(self._cache)} cache entries")
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    def _load_document_hashes(self) -> None:
        if not self.index_file.exists():
            self._document_hashes = {}
            return

        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
                self._document_hashes = json.load(f)
            logger.info(f"Loaded document hashes for {len(self._document_hashes)} documents")
        except Exception as e:
            logger.warning(f"Failed to load document hashes: {e}")
            self._document_hashes = {}

    def _save_document_hashes(self) -> None:
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(self._document_hashes, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save document hashes: {e}")

    def _compute_query_hash(self, query: str) -> str:
        normalized = query.strip().lower()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def get(self, query: str) -> Optional[List[Dict[str, Any]]]:
        if not self.enabled:
            return None

        query_hash = self._compute_query_hash(query)
        entry = self._cache.get(query_hash)

        if entry is None:
            logger.debug(f"Cache miss for query: {query[:50]}...")
            return None

        if entry.is_expired():
            logger.debug(f"Cache entry expired for query: {query[:50]}...")
            del self._cache[query_hash]
            self._save_cache()
            return None

        entry.access_count += 1
        entry.last_accessed = time.time()
        self._cache.move_to_end(query_hash)

        logger.debug(f"Cache hit for query: {query[:50]}... (hits: {entry.access_count})")
        return entry.results

    def set(
        self,
        query: str,
        results: List,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        if not self.enabled:
            return

        query_hash = self._compute_query_hash(query)
        ttl = ttl_seconds or self.ttl

        results_dicts = [
            r.to_dict() if hasattr(r, "to_dict") else r for r in results
        ]

        entry = CacheEntry(
            query=query,
            query_hash=query_hash,
            results=results_dicts,
            created_at=time.time(),
            expires_at=time.time() + ttl,
            access_count=1,
            last_accessed=time.time(),
        )

        self._cache[query_hash] = entry
        self._cache.move_to_end(query_hash)

        while len(self._cache) > self.max_entries:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]

        self._save_cache()
        logger.debug(f"Cached results for query: {query[:50]}...")

    def update_document_hash(self, document_id: str, content_hash: str) -> None:
        if not self.enabled:
            return

        old_hash = self._document_hashes.get(document_id)
        self._document_hashes[document_id] = content_hash
        self._save_document_hashes()

        if self.invalidate_on_update and old_hash and old_hash != content_hash:
            logger.info(
                f"Document {document_id} changed, invalidating cache..."
            )
            self.invalidate_all()

    def invalidate(self, query: str) -> bool:
        if not self.enabled:
            return False

        query_hash = self._compute_query_hash(query)
        if query_hash in self._cache:
            del self._cache[query_hash]
            self._save_cache()
            logger.info(f"Invalidated cache for query: {query[:50]}...")
            return True
        return False

    def invalidate_all(self) -> int:
        if not self.enabled:
            return 0

        count = len(self._cache)
        self._cache.clear()
        self._save_cache()
        logger.info(f"Invalidated all cache entries ({count})")
        return count

    def invalidate_by_document(self, document_id: str) -> int:
        if not self.enabled:
            return 0

        keys_to_delete = []
        for query_hash, entry in self._cache.items():
            for result in entry.results:
                if result.get("document_id") == document_id:
                    keys_to_delete.append(query_hash)
                    break

        for key in keys_to_delete:
            del self._cache[key]

        if keys_to_delete:
            self._save_cache()

        logger.info(
            f"Invalidated {len(keys_to_delete)} cache entries "
            f"for document {document_id}"
        )
        return len(keys_to_delete)

    def clear_expired(self) -> int:
        if not self.enabled:
            return 0

        expired_keys = [
            k for k, v in self._cache.items() if v.is_expired()
        ]
        for key in expired_keys:
            del self._cache[key]

        if expired_keys:
            self._save_cache()

        logger.info(f"Cleared {len(expired_keys)} expired cache entries")
        return len(expired_keys)

    def get_stats(self) -> Dict[str, Any]:
        total_entries = len(self._cache)
        expired_count = sum(1 for e in self._cache.values() if e.is_expired())
        total_accesses = sum(e.access_count for e in self._cache.values())

        return {
            "enabled": self.enabled,
            "total_entries": total_entries,
            "expired_entries": expired_count,
            "active_entries": total_entries - expired_count,
            "total_accesses": total_accesses,
            "max_entries": self.max_entries,
            "ttl_seconds": self.ttl,
            "document_count": len(self._document_hashes),
        }

    def get_document_hash(self, document_id: str) -> Optional[str]:
        return self._document_hashes.get(document_id)


from .config import get_config
