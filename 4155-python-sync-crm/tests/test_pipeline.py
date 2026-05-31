from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional

import pytest

from crm_sync.core.pipeline import SyncPipeline, PipelineContext, SyncResult
from crm_sync.core.source import SyncSource
from crm_sync.core.target import SyncTarget
from crm_sync.core.transformer import SyncTransformer
from crm_sync.core.verifier import SyncVerifier


class MockFieldMapping:
    def __init__(self):
        self.deduplication_fields = ["id"]
        self.source_primary_key = "id"
        self.target_primary_key = "id"
        self.mappings = []


class MockSource(SyncSource):
    def __init__(self, data: List[Dict[str, Any]]):
        super().__init__(entity_type="test")
        self._data = data

    def read(self, **kwargs: Any) -> Iterator[Dict[str, Any]]:
        for record in self._data:
            yield record

    def read_batch(self, batch_size: int, **kwargs: Any) -> List[Dict[str, Any]]:
        offset = kwargs.get("offset", 0)
        return self._data[offset:offset + batch_size]

    def get_count(self, **kwargs: Any) -> int:
        return len(self._data)

    def read_incremental(self, since: datetime, **kwargs: Any) -> Iterator[Dict[str, Any]]:
        for record in self._data:
            yield record

    def read_by_id(self, record_id: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
        for record in self._data:
            if str(record.get("id")) == record_id:
                return record
        return None

    def read_by_ids(self, record_ids: List[str], **kwargs: Any) -> List[Dict[str, Any]]:
        result = []
        for rid in record_ids:
            record = self.read_by_id(rid)
            if record:
                result.append(record)
        return result


class MockTransformer(SyncTransformer):
    def __init__(self):
        super().__init__(mapping_config=MockFieldMapping(), is_crm_source=True)

    def transform(self, data: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
        transformed = {}
        for key, value in data.items():
            transformed[key] = value
        transformed["sync_source"] = "crm"
        return transformed

    def transform_batch(self, data_list: List[Dict[str, Any]], **kwargs: Any) -> List[Dict[str, Any]]:
        return [self.transform(r, **kwargs) for r in data_list]

    def validate(self, data: Dict[str, Any], **kwargs: Any) -> List[str]:
        return []


class MockTarget(SyncTarget):
    def __init__(self):
        super().__init__(entity_type="test")
        self.written = []
        self.updated = []
        self.deleted = []

    def write(self, data: Dict[str, Any], **kwargs: Any) -> Optional[str]:
        self.written.append(data)
        return str(data.get("id", len(self.written)))

    def write_batch(self, data_list: List[Dict[str, Any]], **kwargs: Any) -> List[str]:
        return [self.write(data) for data in data_list]

    def update(self, record_id: str, data: Dict[str, Any], **kwargs: Any) -> bool:
        self.updated.append({"id": record_id, "data": data})
        return True

    def delete(self, record_id: str, **kwargs: Any) -> bool:
        self.deleted.append(record_id)
        return True

    def upsert(
        self,
        data: Dict[str, Any],
        deduplication_fields: List[str] = None,
        **kwargs: Any,
    ) -> tuple[Optional[str], bool]:
        self.written.append(data)
        return (str(data.get("id", len(self.written))), True)

    def check_circular_sync(self, data: Dict[str, Any]) -> bool:
        return False


class MockVerifier(SyncVerifier):
    def __init__(self, should_match: bool = True):
        super().__init__(entity_type="test", fields_to_verify=None)
        self._should_match = should_match

    def verify(self, source_data: Dict[str, Any], target_data: Dict[str, Any], **kwargs: Any) -> bool:
        return self._should_match

    def get_differences(
        self, source_data: Dict[str, Any], target_data: Dict[str, Any], **kwargs: Any
    ) -> List[str]:
        return []

    def fetch_target_data(self, record_id: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
        return {"id": record_id}

    def verify_record(self, record_id: str, source_data: Dict[str, Any], **kwargs: Any) -> tuple[bool, List[str]]:
        return (self._should_match, [])

    def verify_batch(
        self, records: List[tuple[str, Dict[str, Any]]], **kwargs: Any
    ) -> List[tuple[str, bool, List[str]]]:
        return [(rid, self._should_match, []) for rid, _ in records]


def test_sync_pipeline_create():
    source = MockSource([{"id": 1, "name": "Test"}])
    transformer = MockTransformer()
    target = MockTarget()
    verifier = MockVerifier()

    pipeline = SyncPipeline(
        source=source,
        transformer=transformer,
        target=target,
        verifier=verifier,
        batch_size=100,
    )

    assert pipeline.source == source
    assert pipeline.transformer == transformer
    assert pipeline.target == target
    assert pipeline.verifier == verifier


def test_sync_pipeline_run_full_sync():
    test_data = [
        {"id": 1, "name": "Customer 1"},
        {"id": 2, "name": "Customer 2"},
    ]

    source = MockSource(test_data)
    transformer = MockTransformer()
    target = MockTarget()
    verifier = MockVerifier(should_match=True)

    pipeline = SyncPipeline(
        source=source,
        transformer=transformer,
        target=target,
        verifier=verifier,
    )

    result = pipeline.run_full_sync()

    assert result.success is True
    assert result.context.total_records == 2
    assert result.context.success_count == 2
    assert result.context.failed_count == 0
    assert len(target.written) == 2
    assert target.written[0]["sync_source"] == "crm"


def test_sync_pipeline_without_verifier():
    test_data = [{"id": 1, "name": "Test"}]

    source = MockSource(test_data)
    transformer = MockTransformer()
    target = MockTarget()

    pipeline = SyncPipeline(
        source=source,
        transformer=transformer,
        target=target,
        verifier=None,
    )

    result = pipeline.run_full_sync()

    assert result.context.total_records == 1
    assert result.context.success_count == 1


def test_sync_pipeline_single_record():
    test_data = [{"id": 123, "name": "Single Customer"}]

    source = MockSource(test_data)
    transformer = MockTransformer()
    target = MockTarget()

    pipeline = SyncPipeline(
        source=source,
        transformer=transformer,
        target=target,
    )

    result = pipeline.sync_single_record(record_id="123")

    assert result is not None
    assert result.success is True
    assert len(target.written) == 1
