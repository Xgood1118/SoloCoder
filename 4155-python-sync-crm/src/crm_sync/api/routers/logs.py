from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc

from crm_sync.infrastructure import get_db_session
from crm_sync.models import SyncLog, SyncStatus

router = APIRouter()


class SyncLogResponse(BaseModel):
    id: int
    task_id: str
    entity_type: str
    operation_type: str
    record_count: int
    success_count: int
    failed_count: int
    skipped_count: int
    duration_ms: int
    status: str
    error_detail: Optional[str]
    sync_source: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    created_at: str


@router.get("", response_model=List[SyncLogResponse])
async def get_sync_logs(
    entity_type: Optional[str] = None,
    status: Optional[str] = None,
    operation_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    try:
        with get_db_session() as db:
            query = db.query(SyncLog)

            if entity_type:
                query = query.filter(SyncLog.entity_type == entity_type)
            if status:
                query = query.filter(SyncLog.status == SyncStatus(status))
            if operation_type:
                query = query.filter(SyncLog.operation_type == operation_type)

            logs = query.order_by(desc(SyncLog.created_at)).offset(offset).limit(limit).all()

            return [
                SyncLogResponse(
                    id=log.id,
                    task_id=log.task_id,
                    entity_type=log.entity_type,
                    operation_type=log.operation_type,
                    record_count=log.record_count,
                    success_count=log.success_count,
                    failed_count=log.failed_count,
                    skipped_count=log.skipped_count,
                    duration_ms=log.duration_ms,
                    status=log.status,
                    error_detail=log.error_detail,
                    sync_source=log.sync_source,
                    start_time=log.start_time.isoformat() if log.start_time else None,
                    end_time=log.end_time.isoformat() if log.end_time else None,
                    created_at=log.created_at.isoformat(),
                )
                for log in logs
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{log_id}", response_model=SyncLogResponse)
async def get_sync_log(log_id: int):
    try:
        with get_db_session() as db:
            log = db.query(SyncLog).filter(SyncLog.id == log_id).first()
            if not log:
                raise HTTPException(status_code=404, detail="Sync log not found")

            return SyncLogResponse(
                id=log.id,
                task_id=log.task_id,
                entity_type=log.entity_type,
                operation_type=log.operation_type,
                record_count=log.record_count,
                success_count=log.success_count,
                failed_count=log.failed_count,
                skipped_count=log.skipped_count,
                duration_ms=log.duration_ms,
                status=log.status,
                error_detail=log.error_detail,
                sync_source=log.sync_source,
                start_time=log.start_time.isoformat() if log.start_time else None,
                end_time=log.end_time.isoformat() if log.end_time else None,
                created_at=log.created_at.isoformat(),
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task/{task_id}", response_model=List[SyncLogResponse])
async def get_logs_by_task(task_id: str):
    try:
        with get_db_session() as db:
            logs = (
                db.query(SyncLog)
                .filter(SyncLog.task_id == task_id)
                .order_by(desc(SyncLog.created_at))
                .all()
            )

            return [
                SyncLogResponse(
                    id=log.id,
                    task_id=log.task_id,
                    entity_type=log.entity_type,
                    operation_type=log.operation_type,
                    record_count=log.record_count,
                    success_count=log.success_count,
                    failed_count=log.failed_count,
                    skipped_count=log.skipped_count,
                    duration_ms=log.duration_ms,
                    status=log.status,
                    error_detail=log.error_detail,
                    sync_source=log.sync_source,
                    start_time=log.start_time.isoformat() if log.start_time else None,
                    end_time=log.end_time.isoformat() if log.end_time else None,
                    created_at=log.created_at.isoformat(),
                )
                for log in logs
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/daily")
async def get_daily_summary(days: int = 7):
    try:
        from datetime import datetime, timedelta
        from sqlalchemy import func, cast, Date

        with get_db_session() as db:
            start_date = datetime.utcnow() - timedelta(days=days)

            results = (
                db.query(
                    cast(SyncLog.created_at, Date).label("date"),
                    SyncLog.entity_type,
                    SyncLog.status,
                    func.count(SyncLog.id).label("count"),
                    func.sum(SyncLog.success_count).label("total_success"),
                    func.sum(SyncLog.failed_count).label("total_failed"),
                    func.avg(SyncLog.duration_ms).label("avg_duration"),
                )
                .filter(SyncLog.created_at >= start_date)
                .group_by(
                    cast(SyncLog.created_at, Date),
                    SyncLog.entity_type,
                    SyncLog.status,
                )
                .all()
            )

            summary = {}
            for r in results:
                date_key = str(r.date)
                if date_key not in summary:
                    summary[date_key] = {}
                if r.entity_type not in summary[date_key]:
                    summary[date_key][r.entity_type] = {}

                summary[date_key][r.entity_type][r.status] = {
                    "count": r.count,
                    "total_success": r.total_success or 0,
                    "total_failed": r.total_failed or 0,
                    "avg_duration_ms": float(r.avg_duration) if r.avg_duration else 0,
                }

            return {"days": days, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
