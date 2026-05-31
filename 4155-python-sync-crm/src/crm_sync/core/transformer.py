from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from crm_sync.config import FieldMappingConfig, apply_field_mapping


class Transformer(ABC):
    @abstractmethod
    def transform(self, data: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
        pass

    @abstractmethod
    def transform_batch(self, data_list: List[Dict[str, Any]], **kwargs: Any) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def validate(self, data: Dict[str, Any], **kwargs: Any) -> List[str]:
        pass


class SyncTransformer(Transformer):
    def __init__(
        self,
        mapping_config: FieldMappingConfig,
        is_crm_source: bool = True,
    ):
        self.mapping_config = mapping_config
        self.is_crm_source = is_crm_source

    def transform(self, data: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
        transformed = apply_field_mapping(
            data, self.mapping_config, self.is_crm_source
        )
        transformed = self._add_sync_metadata(transformed, data)
        return transformed

    def transform_batch(self, data_list: List[Dict[str, Any]], **kwargs: Any) -> List[Dict[str, Any]]:
        results = []
        for data in data_list:
            try:
                transformed = self.transform(data, **kwargs)
                results.append(transformed)
            except Exception:
                continue
        return results

    def validate(self, data: Dict[str, Any], **kwargs: Any) -> List[str]:
        errors = []
        for mapping in self.mapping_config.mappings:
            if mapping.required:
                if self.is_crm_source:
                    field = mapping.source_field
                else:
                    field = mapping.target_field
                if field not in data or data[field] is None or data[field] == "":
                    errors.append(f"Required field missing: {field}")
        return errors

    def _add_sync_metadata(
        self, transformed: Dict[str, Any], original: Dict[str, Any]
    ) -> Dict[str, Any]:
        source = "crm" if self.is_crm_source else "marketing"
        transformed["sync_source"] = source
        transformed["sync_original_id"] = original.get(
            self.mapping_config.source_primary_key
            if self.is_crm_source
            else self.mapping_config.target_primary_key
        )
        return transformed

    def set_direction(self, is_crm_source: bool) -> None:
        self.is_crm_source = is_crm_source
