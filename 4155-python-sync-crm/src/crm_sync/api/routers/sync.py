from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from crm_sync.infrastructure import get_db_session
from crm_sync.infrastructure.redis_client import get_redis_client
from crm_sync.services import (
    CustomerSyncService,
    ContactSyncService,
    LeadSyncService,
    OrderSyncService,
)
from crm_sync.tasks import (
    sync_customer_full,
    sync_contact_full,
    sync_lead_full,
    sync_order_full,
    run_full_sync_all,
)

router = APIRouter()


class SyncResponse(BaseModel):
    task_id: str
    status: str
    message: str


class SyncStatusResponse(BaseModel):
    entity_type: str
    status: str
    last_sync_time: Optional[str]
    success_count: Optional[int]
    failed_count: Optional[int]
    duration_ms: Optional[int]


class SyncResultResponse(BaseModel):
    success: bool
    success_count: int
    failed_count: int
    skipped_count: int
    duration_ms: int
    message: str


@router.post("/customer/full", response_model=SyncResponse)
async def trigger_customer_full_sync():
    try:
        task = sync_customer_full.delay()
        return SyncResponse(
            task_id=task.id,
            status="queued",
            message="Customer full sync task has been queued",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/contact/full", response_model=SyncResponse)
async def trigger_contact_full_sync():
    try:
        task = sync_contact_full.delay()
        return SyncResponse(
            task_id=task.id,
            status="queued",
            message="Contact full sync task has been queued",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lead/full", response_model=SyncResponse)
async def trigger_lead_full_sync():
    try:
        task = sync_lead_full.delay()
        return SyncResponse(
            task_id=task.id,
            status="queued",
            message="Lead full sync task has been queued",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/order/full", response_model=SyncResponse)
async def trigger_order_full_sync():
    try:
        task = sync_order_full.delay()
        return SyncResponse(
            task_id=task.id,
            status="queued",
            message="Order full sync task has been queued",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/all/full", response_model=SyncResponse)
async def trigger_full_sync_all():
    try:
        task = run_full_sync_all.delay()
        return SyncResponse(
            task_id=task.id,
            status="queued",
            message="Full sync for all entities has been queued",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/customer/{record_id}")
async def sync_single_customer(record_id: str):
    try:
        with get_db_session() as db:
            service = CustomerSyncService(db_session=db)
            result = service.sync_single(record_id)
            return SyncResultResponse(
                success=result.success,
                success_count=result.context.success_count,
                failed_count=result.context.failed_count,
                skipped_count=result.context.skipped_count,
                duration_ms=result.context.get_duration_ms(),
                message=result.message,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lead/{record_id}/assign")
async def assign_lead_owner(
    record_id: str,
    region: Optional[str] = None,
    industry: Optional[str] = None,
):
    try:
        with get_db_session() as db:
            service = LeadSyncService(db_session=db)
            owner_id = service.assign_lead_owner(record_id, region, industry)
            return {
                "success": owner_id is not None,
                "lead_id": record_id,
                "assigned_owner": owner_id,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{entity_type}", response_model=SyncStatusResponse)
async def get_sync_status(entity_type: str):
    try:
        redis = get_redis_client()
        status_key = f"sync:status:{entity_type}"
        status_data = redis.get_json(status_key) or {}

        return SyncStatusResponse(
            entity_type=entity_type,
            status=status_data.get("status", "unknown"),
            last_sync_time=status_data.get("last_updated"),
            success_count=status_data.get("success_count"),
            failed_count=status_data.get("failed_count"),
            duration_ms=status_data.get("duration_ms"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=List[SyncStatusResponse])
async def get_all_sync_status():
    try:
        redis = get_redis_client()
        entity_types = ["customer", "contact", "lead", "order"]
        results = []

        for entity_type in entity_types:
            status_key = f"sync:status:{entity_type}"
            status_data = redis.get_json(status_key) or {}
            results.append(
                SyncStatusResponse(
                    entity_type=entity_type,
                    status=status_data.get("status", "unknown"),
                    last_sync_time=status_data.get("last_updated"),
                    success_count=status_data.get("success_count"),
                    failed_count=status_data.get("failed_count"),
                    duration_ms=status_data.get("duration_ms"),
                )
            )

        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/customer/{customer_id}/with-contacts")
async def sync_customer_with_contacts(customer_id: str):
    try:
        with get_db_session() as db:
            service = CustomerSyncService(db_session=db)
            result = service.sync_customer_with_contacts(customer_id)
            return {
                "customer_id": customer_id,
                "customer_sync_success": result["customer"].success,
                "contacts_synced": len(result["contacts"]),
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lead/conflicts")
async def get_lead_conflicts(
    phone: Optional[str] = None,
    email: Optional[str] = None,
):
    try:
        with get_db_session() as db:
            service = LeadSyncService(db_session=db)
            conflicts = service.find_duplicate_leads(phone=phone, email=email)
            return {"conflicts": conflicts, "count": len(conflicts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
