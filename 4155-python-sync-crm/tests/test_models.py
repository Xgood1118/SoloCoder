from datetime import datetime, timezone

from crm_sync.models.sync_log import OperationType, SyncLog, SyncStatus
from crm_sync.models.sync_mapping import MappingStatus, SyncMapping


def test_sync_mapping_creation(db_session):
    mapping = SyncMapping(
        local_id="CRM123",
        remote_id="UUID-456",
        entity_type="customer",
        sync_version=1,
        status=MappingStatus.ACTIVE,
    )

    db_session.add(mapping)
    db_session.commit()

    saved = db_session.query(SyncMapping).filter_by(local_id="CRM123").first()
    assert saved is not None
    assert saved.remote_id == "UUID-456"
    assert saved.entity_type == "customer"
    assert saved.sync_version == 1
    assert saved.status == MappingStatus.ACTIVE


def test_sync_mapping_soft_delete(db_session):
    mapping = SyncMapping(
        local_id="CRM456",
        remote_id="UUID-789",
        entity_type="customer",
        status=MappingStatus.ACTIVE,
    )

    db_session.add(mapping)
    db_session.commit()

    mapping.mark_deleted()
    db_session.commit()

    saved = db_session.query(SyncMapping).filter_by(local_id="CRM456").first()
    assert saved.status == MappingStatus.DELETED
    assert saved.deleted_at is not None


def test_sync_log_creation(db_session):
    log = SyncLog(
        task_id="task-123",
        entity_type="customer",
        operation_type=OperationType.FULL_SYNC,
        record_count=100,
        success_count=98,
        failed_count=2,
        duration_ms=5000,
        status=SyncStatus.COMPLETED,
        error_detail=None,
    )

    db_session.add(log)
    db_session.commit()

    saved = db_session.query(SyncLog).filter_by(task_id="task-123").first()
    assert saved is not None
    assert saved.entity_type == "customer"
    assert saved.operation_type == OperationType.FULL_SYNC
    assert saved.record_count == 100
    assert saved.success_count == 98
    assert saved.failed_count == 2


def test_sync_log_with_error(db_session):
    log = SyncLog(
        task_id="task-456",
        entity_type="lead",
        operation_type=OperationType.INCREMENTAL_SYNC,
        record_count=50,
        success_count=0,
        failed_count=50,
        duration_ms=1000,
        status=SyncStatus.FAILED,
        error_detail='{"error": "connection timeout"}',
    )

    db_session.add(log)
    db_session.commit()

    saved = db_session.query(SyncLog).filter_by(task_id="task-456").first()
    assert saved.status == SyncStatus.FAILED
    assert saved.error_detail is not None
    assert "connection timeout" in saved.error_detail


def test_sync_mapping_optimistic_lock(db_session):
    mapping = SyncMapping(
        local_id="CRM789",
        remote_id="UUID-001",
        entity_type="customer",
        sync_version=1,
        status=MappingStatus.ACTIVE,
    )

    db_session.add(mapping)
    db_session.commit()

    mapping.sync_version += 1
    db_session.commit()

    saved = db_session.query(SyncMapping).filter_by(local_id="CRM789").first()
    assert saved.sync_version == 2
