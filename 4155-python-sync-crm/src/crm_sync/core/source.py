from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional


class Source(ABC):
    @abstractmethod
    def read(self, **kwargs: Any) -> Iterator[Dict[str, Any]]:
        pass

    @abstractmethod
    def read_batch(self, batch_size: int, **kwargs: Any) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_count(self, **kwargs: Any) -> int:
        pass


class SyncSource(Source):
    def __init__(self, entity_type: str):
        self.entity_type = entity_type
        self.last_sync_time: Optional[datetime] = None

    def set_last_sync_time(self, sync_time: datetime) -> None:
        self.last_sync_time = sync_time

    @abstractmethod
    def read(self, **kwargs: Any) -> Iterator[Dict[str, Any]]:
        pass

    @abstractmethod
    def read_batch(self, batch_size: int, **kwargs: Any) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_count(self, **kwargs: Any) -> int:
        pass

    @abstractmethod
    def read_incremental(self, since: datetime, **kwargs: Any) -> Iterator[Dict[str, Any]]:
        pass

    @abstractmethod
    def read_by_id(self, record_id: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def read_by_ids(self, record_ids: List[str], **kwargs: Any) -> List[Dict[str, Any]]:
        pass
