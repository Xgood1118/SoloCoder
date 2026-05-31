from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional, Tuple

from loguru import logger
from sqlalchemy.orm import Session

from crm_sync.config import get_settings
from crm_sync.core.source import SyncSource
from crm_sync.core.target import SyncTarget
from crm_sync.core.verifier import SyncVerifier
from crm_sync.models import SyncMapping, MappingStatus
from .base import BaseAPIAdapter


class CRMSource(SyncSource):
    def __init__(self, entity_type: str, api_adapter: BaseAPIAdapter):
        super().__init__(entity_type)
        self.api = api_adapter
        self._endpoint_map = {
            "customer": "/customers",
            "contact": "/contacts",
            "lead": "/leads",
            "order": "/orders",
        }

    def read(self, **kwargs: Any) -> Iterator[Dict[str, Any]]:
        offset = 0
        limit = kwargs.get("limit", 100)
        while True:
            batch = self.read_batch(limit, offset=offset, **kwargs)
            if not batch:
                break
            for record in batch:
                yield record
            offset += len(batch)

    def read_batch(self, batch_size: int, **kwargs: Any) -> List[Dict[str, Any]]:
        endpoint = self._endpoint_map.get(self.entity_type, f"/{self.entity_type}s")
        params = {
            "limit": batch_size,
            "offset": kwargs.get("offset", 0),
        }
        if "since" in kwargs:
            params["updated_after"] = kwargs["since"].isoformat()
        try:
            response = self.api.get(endpoint, params=params)
            return response.get("data", [])
        except Exception as e:
            logger.error(f"Failed to read batch from CRM {self.entity_type}: {e}")
            return []

    def get_count(self, **kwargs: Any) -> int:
        endpoint = self._endpoint_map.get(self.entity_type, f"/{self.entity_type}s")
        endpoint = f"{endpoint}/count"
        params = {}
        if "since" in kwargs:
            params["updated_after"] = kwargs["since"].isoformat()
        try:
            response = self.api.get(endpoint, params=params)
            return response.get("count", 0)
        except Exception as e:
            logger.error(f"Failed to get count from CRM {self.entity_type}: {e}")
            return 0

    def read_incremental(self, since: datetime, **kwargs: Any) -> Iterator[Dict[str, Any]]:
        return self.read(since=since, **kwargs)

    def read_by_id(self, record_id: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
        endpoint = f"{self._endpoint_map.get(self.entity_type, f'/{self.entity_type}s')}/{record_id}"
        try:
            response = self.api.get(endpoint)
            return response.get("data")
        except Exception as e:
            logger.error(f"Failed to read record {record_id} from CRM: {e}")
            return None

    def read_by_ids(self, record_ids: List[str], **kwargs: Any) -> List[Dict[str, Any]]:
        results = []
        for record_id in record_ids:
            record = self.read_by_id(record_id)
            if record:
                results.append(record)
        return results


class CRMTarget(SyncTarget):
    def __init__(self, entity_type: str, api_adapter: BaseAPIAdapter, db_session: Session):
        super().__init__(entity_type)
        self.api = api_adapter
        self.db = db_session
        self._endpoint_map = {
            "customer": "/customers",
            "contact": "/contacts",
            "lead": "/leads",
            "order": "/orders",
        }

    def write(self, data: Dict[str, Any], **kwargs: Any) -> Optional[str]:
        endpoint = self._endpoint_map.get(self.entity_type, f"/{self.entity_type}s")
        try:
            response = self.api.post(endpoint, json_data=data)
            record_id = response.get("data", {}).get("id")
            if record_id:
                self._update_mapping(data, str(record_id))
            return str(record_id) if record_id else None
        except Exception as e:
            logger.error(f"Failed to write to CRM {self.entity_type}: {e}")
            return None

    def write_batch(self, data_list: List[Dict[str, Any]], **kwargs: Any) -> List[str]:
        results = []
        for data in data_list:
            record_id = self.write(data, **kwargs)
            if record_id:
                results.append(record_id)
        return results

    def update(self, record_id: str, data: Dict[str, Any], **kwargs: Any) -> bool:
        endpoint = f"{self._endpoint_map.get(self.entity_type, f'/{self.entity_type}s')}/{record_id}"
        try:
            self.api.put(endpoint, json_data=data)
            return True
        except Exception as e:
            logger.error(f"Failed to update record {record_id} in CRM: {e}")
            return False

    def delete(self, record_id: str, **kwargs: Any) -> bool:
        endpoint = f"{self._endpoint_map.get(self.entity_type, f'/{self.entity_type}s')}/{record_id}"
        try:
            self.api.delete(endpoint)
            return True
        except Exception as e:
            logger.error(f"Failed to delete record {record_id} from CRM: {e}")
            return False

    def upsert(
        self,
        data: Dict[str, Any],
        deduplication_fields: List[str],
        **kwargs: Any,
    ) -> Tuple[Optional[str], bool]:
        existing_id = self._find_existing_record(data, deduplication_fields)
        if existing_id:
            success = self.update(existing_id, data, **kwargs)
            return (existing_id if success else None, False)
        else:
            record_id = self.write(data, **kwargs)
            return (record_id, True)

    def check_circular_sync(self, data: Dict[str, Any]) -> bool:
        sync_source = data.get("sync_source", "")
        return sync_source == "crm"

    def _find_existing_record(
        self, data: Dict[str, Any], deduplication_fields: List[str]
    ) -> Optional[str]:
        remote_id = data.get("sync_original_id")
        if remote_id:
            mapping = (
                self.db.query(SyncMapping)
                .filter(
                    SyncMapping.remote_id == str(remote_id),
                    SyncMapping.entity_type == self.entity_type,
                    SyncMapping.status == MappingStatus.ACTIVE,
                )
                .first()
            )
            if mapping:
                return mapping.local_id
        return None

    def _update_mapping(self, data: Dict[str, Any], record_id: str) -> None:
        remote_id = data.get("sync_original_id")
        if not remote_id:
            return
        existing = (
            self.db.query(SyncMapping)
            .filter(
                SyncMapping.remote_id == str(remote_id),
                SyncMapping.entity_type == self.entity_type,
            )
            .first()
        )
        if existing:
            existing.local_id = record_id
            existing.last_sync_time = datetime.utcnow()
        else:
            mapping = SyncMapping(
                local_id=record_id,
                remote_id=str(remote_id),
                entity_type=self.entity_type,
                sync_source=data.get("sync_source"),
            )
            self.db.add(mapping)
        self.db.commit()


class CRMVerifier(SyncVerifier):
    def __init__(self, entity_type: str, api_adapter: BaseAPIAdapter):
        super().__init__(entity_type)
        self.api = api_adapter
        self._endpoint_map = {
            "customer": "/customers",
            "contact": "/contacts",
            "lead": "/leads",
            "order": "/orders",
        }

    def fetch_target_data(self, record_id: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
        endpoint = f"{self._endpoint_map.get(self.entity_type, f'/{self.entity_type}s')}/{record_id}"
        try:
            response = self.api.get(endpoint)
            return response.get("data")
        except Exception as e:
            logger.error(f"Failed to fetch record {record_id} from CRM: {e}")
            return None

    def verify_record(self, record_id: str, source_data: Dict[str, Any], **kwargs: Any) -> Tuple[bool, List[str]]:
        target_data = self.fetch_target_data(record_id, **kwargs)
        if not target_data:
            return False, ["Record not found in target system"]
        differences = self.get_differences(source_data, target_data, **kwargs)
        return (len(differences) == 0, differences)

    def verify_batch(
        self, records: List[Tuple[str, Dict[str, Any]]], **kwargs: Any
    ) -> List[Tuple[str, bool, List[str]]]:
        results = []
        for record_id, source_data in records:
            is_valid, diffs = self.verify_record(record_id, source_data, **kwargs)
            results.append((record_id, is_valid, diffs))
        return results


class CRMAdapter:
    def __init__(self, db_session: Optional[Session] = None):
        settings = get_settings()
        self.api = BaseAPIAdapter(
            base_url=settings.crm.api_base_url,
            api_key=settings.crm.api_key,
            timeout=settings.crm.timeout,
        )
        self.db_session = db_session

    def get_source(self, entity_type: str) -> CRMSource:
        return CRMSource(entity_type, self.api)

    def get_target(self, entity_type: str, db_session: Optional[Session] = None) -> CRMTarget:
        session = db_session or self.db_session
        if not session:
            raise ValueError("Database session is required for target adapter")
        return CRMTarget(entity_type, self.api, session)

    def get_verifier(self, entity_type: str) -> CRMVerifier:
        return CRMVerifier(entity_type, self.api)

    def close(self) -> None:
        self.api.close()


class CRMContactAdapter(CRMAdapter):
    pass


class CRMLeadAdapter(CRMAdapter):
    pass


class CRMOrderAdapter(CRMAdapter):
    pass
