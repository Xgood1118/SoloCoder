from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class Target(ABC):
    @abstractmethod
    def write(self, data: Dict[str, Any], **kwargs: Any) -> Optional[str]:
        pass

    @abstractmethod
    def write_batch(self, data_list: List[Dict[str, Any]], **kwargs: Any) -> List[str]:
        pass

    @abstractmethod
    def update(self, record_id: str, data: Dict[str, Any], **kwargs: Any) -> bool:
        pass

    @abstractmethod
    def delete(self, record_id: str, **kwargs: Any) -> bool:
        pass


class SyncTarget(Target):
    def __init__(self, entity_type: str):
        self.entity_type = entity_type

    @abstractmethod
    def write(self, data: Dict[str, Any], **kwargs: Any) -> Optional[str]:
        pass

    @abstractmethod
    def write_batch(self, data_list: List[Dict[str, Any]], **kwargs: Any) -> List[str]:
        pass

    @abstractmethod
    def update(self, record_id: str, data: Dict[str, Any], **kwargs: Any) -> bool:
        pass

    @abstractmethod
    def delete(self, record_id: str, **kwargs: Any) -> bool:
        pass

    @abstractmethod
    def upsert(
        self,
        data: Dict[str, Any],
        deduplication_fields: List[str],
        **kwargs: Any,
    ) -> tuple[Optional[str], bool]:
        pass

    @abstractmethod
    def check_circular_sync(self, data: Dict[str, Any]) -> bool:
        pass
