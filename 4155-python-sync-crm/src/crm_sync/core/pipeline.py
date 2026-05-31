import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from loguru import logger

from .source import SyncSource
from .transformer import SyncTransformer
from .target import SyncTarget
from .verifier import SyncVerifier


@dataclass
class PipelineContext:
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str = ""
    operation_type: str = "incremental"
    batch_size: int = 100
    start_time: datetime = field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    total_records: int = 0
    success_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    errors: List[str] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)

    def add_error(self, error: str) -> None:
        self.errors.append(error)

    def get_duration_ms(self) -> int:
        end = self.end_time or datetime.utcnow()
        return int((end - self.start_time).total_seconds() * 1000)


@dataclass
class SyncResult:
    success: bool
    context: PipelineContext
    message: str = ""


class SyncPipeline:
    def __init__(
        self,
        source: SyncSource,
        transformer: SyncTransformer,
        target: SyncTarget,
        verifier: Optional[SyncVerifier] = None,
        batch_size: int = 100,
    ):
        self.source = source
        self.transformer = transformer
        self.target = target
        self.verifier = verifier
        self.batch_size = batch_size
        self.before_sync_hooks: List[Callable[[PipelineContext], None]] = []
        self.after_sync_hooks: List[Callable[[PipelineContext, SyncResult], None]] = []
        self.error_hooks: List[Callable[[PipelineContext, Exception], None]] = []

    def add_before_sync_hook(self, hook: Callable[[PipelineContext], None]) -> None:
        self.before_sync_hooks.append(hook)

    def add_after_sync_hook(
        self, hook: Callable[[PipelineContext, SyncResult], None]
    ) -> None:
        self.after_sync_hooks.append(hook)

    def add_error_hook(
        self, hook: Callable[[PipelineContext, Exception], None]
    ) -> None:
        self.error_hooks.append(hook)

    def run_full_sync(self, context: Optional[PipelineContext] = None) -> SyncResult:
        context = context or PipelineContext(
            entity_type=self.source.entity_type,
            operation_type="full_sync",
            batch_size=self.batch_size,
        )
        return self._run_sync(context, incremental=False)

    def run_incremental_sync(
        self, since: datetime, context: Optional[PipelineContext] = None
    ) -> SyncResult:
        context = context or PipelineContext(
            entity_type=self.source.entity_type,
            operation_type="incremental",
            batch_size=self.batch_size,
        )
        context.extra["since"] = since
        return self._run_sync(context, incremental=True)

    def _run_sync(
        self, context: PipelineContext, incremental: bool
    ) -> SyncResult:
        try:
            for hook in self.before_sync_hooks:
                hook(context)

            if incremental:
                since = context.extra.get("since", datetime.utcnow())
                total_count = self.source.get_count(since=since)
            else:
                total_count = self.source.get_count()

            context.total_records = total_count
            logger.info(
                f"Starting sync for {context.entity_type}: "
                f"{context.operation_type}, total records: {total_count}"
            )

            processed = 0
            while processed < total_count:
                if incremental:
                    since = context.extra.get("since", datetime.utcnow())
                    batch = self.source.read_batch(
                        self.batch_size, offset=processed, since=since
                    )
                else:
                    batch = self.source.read_batch(
                        self.batch_size, offset=processed
                    )

                if not batch:
                    break

                for record in batch:
                    try:
                        result = self._process_record(record)
                        if result:
                            context.success_count += 1
                        else:
                            context.skipped_count += 1
                    except Exception as e:
                        context.failed_count += 1
                        context.add_error(f"Record {record.get('id')}: {str(e)}")
                        logger.error(f"Failed to process record: {e}", exc_info=True)

                processed += len(batch)

            context.end_time = datetime.utcnow()
            result = SyncResult(
                success=context.failed_count == 0,
                context=context,
                message=f"Sync completed: {context.success_count} success, "
                f"{context.failed_count} failed, {context.skipped_count} skipped",
            )

            for hook in self.after_sync_hooks:
                hook(context, result)

            logger.info(
                f"Sync completed for {context.entity_type}: "
                f"duration={context.get_duration_ms()}ms, "
                f"success={context.success_count}, "
                f"failed={context.failed_count}, "
                f"skipped={context.skipped_count}"
            )

            return result

        except Exception as e:
            context.end_time = datetime.utcnow()
            for hook in self.error_hooks:
                hook(context, e)
            logger.error(f"Sync pipeline failed: {e}", exc_info=True)
            return SyncResult(
                success=False,
                context=context,
                message=f"Sync failed: {str(e)}",
            )

    def _process_record(self, record: Dict[str, Any]) -> bool:
        validation_errors = self.transformer.validate(record)
        if validation_errors:
            logger.warning(f"Skipping invalid record: {validation_errors}")
            return False

        transformed = self.transformer.transform(record)

        if self.target.check_circular_sync(transformed):
            logger.debug("Skipping due to circular sync detection")
            return False

        deduplication_fields = self.transformer.mapping_config.deduplication_fields
        record_id, is_new = self.target.upsert(transformed, deduplication_fields)

        if record_id and self.verifier:
            is_valid, diffs = self.verifier.verify_record(record_id, transformed)
            if not is_valid:
                logger.warning(f"Verification failed for record {record_id}: {diffs}")

        return record_id is not None

    def sync_single_record(self, record_id: str) -> SyncResult:
        context = PipelineContext(
            entity_type=self.source.entity_type,
            operation_type="single",
            batch_size=1,
        )
        context.total_records = 1

        try:
            record = self.source.read_by_id(record_id)
            if not record:
                context.skipped_count = 1
                return SyncResult(
                    success=False,
                    context=context,
                    message=f"Record {record_id} not found",
                )

            if self._process_record(record):
                context.success_count = 1
            else:
                context.skipped_count = 1

            context.end_time = datetime.utcnow()
            return SyncResult(
                success=True,
                context=context,
                message=f"Record {record_id} synced successfully",
            )

        except Exception as e:
            context.failed_count = 1
            context.end_time = datetime.utcnow()
            logger.error(f"Single record sync failed: {e}", exc_info=True)
            return SyncResult(
                success=False,
                context=context,
                message=f"Sync failed: {str(e)}",
            )
