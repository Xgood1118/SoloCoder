from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional


class Verifier(ABC):
    @abstractmethod
    def verify(self, source_data: Dict[str, Any], target_data: Dict[str, Any], **kwargs: Any) -> bool:
        pass

    @abstractmethod
    def get_differences(
        self, source_data: Dict[str, Any], target_data: Dict[str, Any], **kwargs: Any
    ) -> List[str]:
        pass


class SyncVerifier(Verifier):
    def __init__(self, entity_type: str, fields_to_verify: Optional[List[str]] = None):
        self.entity_type = entity_type
        self.fields_to_verify = fields_to_verify

    def verify(self, source_data: Dict[str, Any], target_data: Dict[str, Any], **kwargs: Any) -> bool:
        differences = self.get_differences(source_data, target_data, **kwargs)
        return len(differences) == 0

    def get_differences(
        self, source_data: Dict[str, Any], target_data: Dict[str, Any], **kwargs: Any
    ) -> List[str]:
        differences: List[str] = []
        fields = self.fields_to_verify or source_data.keys()

        for field in fields:
            source_val = source_data.get(field)
            target_val = target_data.get(field)

            if isinstance(source_val, datetime) and isinstance(target_val, str):
                source_val = source_val.isoformat()
            elif isinstance(target_val, datetime) and isinstance(source_val, str):
                target_val = target_val.isoformat()

            if source_val != target_val:
                differences.append(
                    f"Field '{field}': source={source_val}, target={target_val}"
                )

        return differences

    @abstractmethod
    def fetch_target_data(self, record_id: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def verify_record(self, record_id: str, source_data: Dict[str, Any], **kwargs: Any) -> tuple[bool, List[str]]:
        pass

    @abstractmethod
    def verify_batch(
        self, records: List[tuple[str, Dict[str, Any]]], **kwargs: Any
    ) -> List[tuple[str, bool, List[str]]]:
        pass
