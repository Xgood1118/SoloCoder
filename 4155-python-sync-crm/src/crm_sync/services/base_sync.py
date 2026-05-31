from datetime import datetime, timedelta
from enum import Enum as PyEnum
from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from crm_sync.adapters import CRMAdapter, MarketingAdapter
from crm_sync.config import FieldMappingConfig, get_settings, load_field_mapping
from crm_sync.core import (
    SyncPipeline,
    SyncResult,
    SyncTransformer,
    PipelineContext,
)
from crm_sync.infrastructure import get_db_session
from crm_sync.models import SyncLog, SyncTask, OperationType, SyncStatus


class SyncDirection(str, PyEnum):
    CRM_TO_MARKETING = "crm_to_marketing"
    MARKETING_TO_CRM = "marketing_to_crm"
    BIDIRECTIONAL = "bidirectional"


class BaseSyncService:
    def __init__(
        self,
        entity_type: str,
        direction: SyncDirection = SyncDirection.CRM_TO_MARKETING,
        db_session: Optional[Session] = None,
    ):
        self.entity_type = entity_type
        self.direction = direction
        self._db = db_session
        self.settings = get_settings()
        self._mapping_config: Optional[FieldMappingConfig] = None

    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = next(get_db_session())
        return self._db

    @property
    def mapping_config(self) -> FieldMappingConfig:
        if self._mapping_config is None:
            mapping_file = f"config/field_mappings/{self.entity_type}.json"
            self._mapping_config = load_field_mapping(mapping_file)
        return self._mapping_config

    def get_last_sync_time(self) -> Optional[datetime]:
        last_log = (
            self.db.query(SyncLog)
            .filter(
                SyncLog.entity_type == self.entity_type,
                SyncLog.status == SyncStatus.SUCCESS,
            )
            .order_by(SyncLog.created_at.desc())
            .first()
        )
        return last_log.end_time if last_log else None

    def get_default_since(self) -> datetime:
        last_sync = self.get_last_sync_time()
        if last_sync:
            return last_sync
        return datetime.utcnow() - timedelta(days=7)

    def create_sync_log(
        self,
        task_id: str,
        operation_type: OperationType,
        sync_source: str,
    ) -> SyncLog:
        log = SyncLog(
            task_id=task_id,
            entity_type=self.entity_type,
            operation_type=operation_type,
            sync_source=sync_source,
        )
        self.db.add(log)
        self.db.commit()
        return log

    def update_sync_log(
        self,
        log: SyncLog,
        result: SyncResult,
    ) -> None:
        log.complete(
            success_count=result.context.success_count,
            failed_count=result.context.failed_count,
            skipped_count=result.context.skipped_count,
            error_detail="\n".join(result.context.errors) if result.context.errors else None,
        )
        self.db.commit()

    def _get_crm_to_marketing_pipeline(self) -> SyncPipeline:
        crm_adapter = CRMAdapter(self.db)
        marketing_adapter = MarketingAdapter(self.db)

        source = crm_adapter.get_source(self.entity_type)
        target = marketing_adapter.get_target(self.entity_type, self.db)
        verifier = marketing_adapter.get_verifier(self.entity_type)
        transformer = SyncTransformer(
            self.mapping_config,
            is_crm_source=True,
        )

        pipeline = SyncPipeline(
            source=source,
            transformer=transformer,
            target=target,
            verifier=verifier,
            batch_size=self.settings.sync.batch_size,
        )
        return pipeline

    def _get_marketing_to_crm_pipeline(self) -> SyncPipeline:
        crm_adapter = CRMAdapter(self.db)
        marketing_adapter = MarketingAdapter(self.db)

        source = marketing_adapter.get_source(self.entity_type)
        target = crm_adapter.get_target(self.entity_type, self.db)
        verifier = crm_adapter.get_verifier(self.entity_type)
        transformer = SyncTransformer(
            self.mapping_config,
            is_crm_source=False,
        )

        pipeline = SyncPipeline(
            source=source,
            transformer=transformer,
            target=target,
            verifier=verifier,
            batch_size=self.settings.sync.batch_size,
        )
        return pipeline

    def get_pipeline(self, direction: Optional[SyncDirection] = None) -> SyncPipeline:
        sync_dir = direction or self.direction
        if sync_dir == SyncDirection.CRM_TO_MARKETING:
            return self._get_crm_to_marketing_pipeline()
        elif sync_dir == SyncDirection.MARKETING_TO_CRM:
            return self._get_marketing_to_crm_pipeline()
        else:
            return self._get_crm_to_marketing_pipeline()

    def sync_incremental(
        self,
        since: Optional[datetime] = None,
        direction: Optional[SyncDirection] = None,
    ) -> SyncResult:
        sync_dir = direction or self.direction
        logger.info(f"Starting incremental sync for {self.entity_type} ({sync_dir})")

        pipeline = self.get_pipeline(sync_dir)
        since_time = since or self.get_default_since()

        context = PipelineContext(
            entity_type=self.entity_type,
            operation_type="incremental",
            batch_size=self.settings.sync.batch_size,
        )

        sync_log = self.create_sync_log(
            task_id=context.task_id,
            operation_type=OperationType.INCREMENTAL,
            sync_source=sync_dir,
        )

        result = pipeline.run_incremental_sync(since=since_time, context=context)
        self.update_sync_log(sync_log, result)

        logger.info(
            f"Incremental sync completed for {self.entity_type}: "
            f"{result.context.success_count} success, "
            f"{result.context.failed_count} failed"
        )
        return result

    def sync_full(
        self,
        direction: Optional[SyncDirection] = None,
    ) -> SyncResult:
        sync_dir = direction or self.direction
        logger.info(f"Starting full sync for {self.entity_type} ({sync_dir})")

        pipeline = self.get_pipeline(sync_dir)

        context = PipelineContext(
            entity_type=self.entity_type,
            operation_type="full_sync",
            batch_size=self.settings.sync.batch_size,
        )

        sync_log = self.create_sync_log(
            task_id=context.task_id,
            operation_type=OperationType.FULL_SYNC,
            sync_source=sync_dir,
        )

        result = pipeline.run_full_sync(context=context)
        self.update_sync_log(sync_log, result)

        logger.info(
            f"Full sync completed for {self.entity_type}: "
            f"{result.context.success_count} success, "
            f"{result.context.failed_count} failed"
        )
        return result

    def sync_single(
        self,
        record_id: str,
        direction: Optional[SyncDirection] = None,
    ) -> SyncResult:
        sync_dir = direction or self.direction
        logger.info(f"Starting single sync for {self.entity_type} record {record_id}")

        pipeline = self.get_pipeline(sync_dir)
        result = pipeline.sync_single_record(record_id)

        logger.info(
            f"Single sync completed for {self.entity_type} record {record_id}: "
            f"{'success' if result.success else 'failed'}"
        )
        return result

    def check_data_consistency(self, limit: int = 100) -> List[Dict[str, Any]]:
        inconsistencies = []
        crm_adapter = CRMAdapter(self.db)
        marketing_adapter = MarketingAdapter(self.db)

        crm_source = crm_adapter.get_source(self.entity_type)
        marketing_verifier = marketing_adapter.get_verifier(self.entity_type)

        records = crm_source.read_batch(limit)
        for record in records:
            record_id = record.get("id")
            if not record_id:
                continue

            from crm_sync.models import SyncMapping, MappingStatus

            mapping = (
                self.db.query(SyncMapping)
                .filter(
                    SyncMapping.local_id == str(record_id),
                    SyncMapping.entity_type == self.entity_type,
                    SyncMapping.status == MappingStatus.ACTIVE,
                )
                .first()
            )

            if mapping and mapping.remote_id:
                target_data = marketing_verifier.fetch_target_data(mapping.remote_id)
                if target_data:
                    transformer = SyncTransformer(
                        self.mapping_config,
                        is_crm_source=True,
                    )
                    transformed = transformer.transform(record)
                    diffs = marketing_verifier.get_differences(transformed, target_data)
                    if diffs:
                        inconsistencies.append(
                            {
                                "record_id": record_id,
                                "remote_id": mapping.remote_id,
                                "differences": diffs,
                            }
                        )

        return inconsistencies
