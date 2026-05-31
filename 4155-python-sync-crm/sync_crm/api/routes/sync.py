"""
同步管理接口
提供手工触发同步、查看同步状态等功能
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from sync_crm.infrastructure.database import get_db
from sync_crm.infrastructure.logging import get_logger
from sync_crm.models.mapping import EntityType
from sync_crm.models.sync_log import TaskStatus, OperationType
from sync_crm.services.customer_sync import CustomerSyncService
from sync_crm.services.contact_sync import ContactSyncService
from sync_crm.services.lead_sync import LeadSyncService
from sync_crm.services.order_sync import OrderSyncService
from sync_crm.tasks.sync_tasks import (
    sync_customer_full,
    sync_contact_full,
    sync_lead_full,
    sync_order_full,
    sync_customer_event,
    sync_contact_event,
    sync_lead_event,
    sync_order_event,
    batch_sync_by_region,
    batch_sync_by_industry,
)

router = APIRouter()
logger = get_logger(__name__)


class SyncTriggerRequest(BaseModel):
    """同步触发请求"""
    operator: Optional[str] = Field(None, description="操作人")
    start_time: Optional[datetime] = Field(None, description="同步起始时间")
    end_time: Optional[datetime] = Field(None, description="同步结束时间")


class SyncResponse(BaseModel):
    """同步响应"""
    task_id: str
    status: str
    message: str


class SyncStatusResponse(BaseModel):
    """同步状态响应"""
    entity_type: str
    last_sync_time: Optional[datetime]
    is_delay: bool
    delay_seconds: int
    latest_tasks: List[dict]


_service_map = {
    EntityType.CUSTOMER: CustomerSyncService,
    EntityType.CONTACT: ContactSyncService,
    EntityType.LEAD: LeadSyncService,
    EntityType.ORDER: OrderSyncService,
}


@router.get("/status/{entity_type}", summary="获取同步状态")
async def get_sync_status(
    entity_type: EntityType,
    task_id: Optional[str] = Query(None, description="指定任务ID"),
    db: Session = Depends(get_db),
) -> SyncStatusResponse:
    """
    获取指定实体类型的同步状态
    """
    service_cls = _service_map.get(entity_type)
    if not service_cls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的实体类型: {entity_type}"
        )

    service = service_cls(db)
    status_data = service.get_sync_status(task_id)
    is_delay, delay_seconds = service.check_delay()

    return SyncStatusResponse(
        entity_type=entity_type.value,
        last_sync_time=status_data.get("last_sync_time"),
        is_delay=is_delay,
        delay_seconds=delay_seconds,
        latest_tasks=status_data.get("latest_tasks", []),
    )


@router.post("/incremental/{entity_type}", summary="触发增量同步", response_model=SyncResponse)
async def trigger_incremental_sync(
    entity_type: EntityType,
    request: SyncTriggerRequest,
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    手工触发增量同步
    """
    service_cls = _service_map.get(entity_type)
    if not service_cls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的实体类型: {entity_type}"
        )

    try:
        service = service_cls(db)
        result = service.sync_incremental(
            sync_source="manual",
        )

        return SyncResponse(
            task_id=result.get("task_id", ""),
            status=result.get("status", "success"),
            message=f"{entity_type.value}增量同步已触发",
        )
    except Exception as e:
        logger.error(f"触发增量同步失败: entity={entity_type}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/full/{entity_type}", summary="触发全量同步", response_model=SyncResponse)
async def trigger_full_sync(
    entity_type: EntityType,
    request: SyncTriggerRequest,
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    手工触发全量同步（异步执行）
    """
    task_map = {
        EntityType.CUSTOMER: sync_customer_full,
        EntityType.CONTACT: sync_contact_full,
        EntityType.LEAD: sync_lead_full,
        EntityType.ORDER: sync_order_full,
    }

    task = task_map.get(entity_type)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的实体类型: {entity_type}"
        )

    try:
        result = task.delay(
            sync_source="manual",
            operator=request.operator,
        )

        return SyncResponse(
            task_id=result.id,
            status="queued",
            message=f"{entity_type.value}全量同步已提交到任务队列",
        )
    except Exception as e:
        logger.error(f"触发全量同步失败: entity={entity_type}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/manual/{entity_type}", summary="手工同步指定数据", response_model=SyncResponse)
async def trigger_manual_sync(
    entity_type: EntityType,
    record_ids: Optional[List[str]] = Query(None, description="指定记录ID列表"),
    start_time: Optional[datetime] = Query(None, description="同步起始时间"),
    end_time: Optional[datetime] = Query(None, description="同步结束时间"),
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    手工同步指定范围的数据
    """
    service_cls = _service_map.get(entity_type)
    if not service_cls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的实体类型: {entity_type}"
        )

    try:
        service = service_cls(db)
        result = service.sync_manual(
            record_ids=record_ids,
            operator=operator,
            start_time=start_time,
            end_time=end_time,
        )

        return SyncResponse(
            task_id=result.get("task_id", ""),
            status=result.get("status", "success"),
            message=f"{entity_type.value}手工同步完成",
        )
    except Exception as e:
        logger.error(f"手工同步失败: entity={entity_type}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/event/customer", summary="客户变更事件回调")
async def customer_event_callback(
    customer_id: str = Query(..., description="CRM客户ID"),
    operation: str = Query(..., description="操作类型: created/updated/deleted"),
    origin: str = Query("crm", description="数据来源"),
) -> SyncResponse:
    """
    CRM客户变更事件回调接口（用于CDC/应用层事件监听）
    """
    allowed_ops = ["created", "updated", "deleted"]
    if operation not in allowed_ops:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"操作类型必须是以下之一: {allowed_ops}"
        )

    try:
        result = sync_customer_event.delay(
            customer_id=customer_id,
            operation=operation,
            origin=origin,
        )

        return SyncResponse(
            task_id=result.id,
            status="queued",
            message=f"客户{operation}事件已接收",
        )
    except Exception as e:
        logger.error(f"客户事件处理失败: customer_id={customer_id}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/event/contact", summary="联系人变更事件回调")
async def contact_event_callback(
    contact_id: str = Query(..., description="CRM联系人ID"),
    operation: str = Query(..., description="操作类型: created/updated/deleted"),
    customer_id: Optional[str] = Query(None, description="关联客户ID"),
    origin: str = Query("crm", description="数据来源"),
) -> SyncResponse:
    """
    CRM联系人变更事件回调接口
    """
    allowed_ops = ["created", "updated", "deleted"]
    if operation not in allowed_ops:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"操作类型必须是以下之一: {allowed_ops}"
        )

    try:
        result = sync_contact_event.delay(
            contact_id=contact_id,
            operation=operation,
            customer_id=customer_id,
            origin=origin,
        )

        return SyncResponse(
            task_id=result.id,
            status="queued",
            message=f"联系人{operation}事件已接收",
        )
    except Exception as e:
        logger.error(f"联系人事件处理失败: contact_id={contact_id}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/event/lead", summary="线索变更事件回调")
async def lead_event_callback(
    lead_id: str = Query(..., description="营销平台线索ID"),
    operation: str = Query(..., description="操作类型: created/updated"),
    origin: str = Query("marketing", description="数据来源"),
) -> SyncResponse:
    """
    营销平台线索变更事件回调接口
    """
    allowed_ops = ["created", "updated"]
    if operation not in allowed_ops:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"操作类型必须是以下之一: {allowed_ops}"
        )

    try:
        result = sync_lead_event.delay(
            lead_id=lead_id,
            operation=operation,
            origin=origin,
        )

        return SyncResponse(
            task_id=result.id,
            status="queued",
            message=f"线索{operation}事件已接收",
        )
    except Exception as e:
        logger.error(f"线索事件处理失败: lead_id={lead_id}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/event/order", summary="订单变更事件回调")
async def order_event_callback(
    order_id: str = Query(..., description="订单ID"),
    operation: str = Query(..., description="操作类型: created/confirmed/paid"),
    origin: str = Query("crm", description="数据来源"),
) -> SyncResponse:
    """
    订单变更事件回调接口
    """
    allowed_ops = ["created", "confirmed", "paid"]
    if operation not in allowed_ops:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"操作类型必须是以下之一: {allowed_ops}"
        )

    try:
        result = sync_order_event.delay(
            order_id=order_id,
            operation=operation,
            origin=origin,
        )

        return SyncResponse(
            task_id=result.id,
            status="queued",
            message=f"订单{operation}事件已接收",
        )
    except Exception as e:
        logger.error(f"订单事件处理失败: order_id={order_id}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/batch/region", summary="按区域批量同步")
async def batch_sync_by_region_endpoint(
    region: str = Query(..., description="区域"),
    operator: Optional[str] = Query(None, description="操作人"),
) -> SyncResponse:
    """
    按区域批量同步客户数据
    """
    try:
        result = batch_sync_by_region.delay(
            region=region,
            operator=operator,
        )

        return SyncResponse(
            task_id=result.id,
            status="queued",
            message=f"按区域[{region}]批量同步已提交",
        )
    except Exception as e:
        logger.error(f"按区域批量同步失败: region={region}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/batch/industry", summary="按行业批量同步")
async def batch_sync_by_industry_endpoint(
    industry: str = Query(..., description="行业"),
    operator: Optional[str] = Query(None, description="操作人"),
) -> SyncResponse:
    """
    按行业批量同步客户数据
    """
    try:
        result = batch_sync_by_industry.delay(
            industry=industry,
            operator=operator,
        )

        return SyncResponse(
            task_id=result.id,
            status="queued",
            message=f"按行业[{industry}]批量同步已提交",
        )
    except Exception as e:
        logger.error(f"按行业批量同步失败: industry={industry}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/task/{task_id}", summary="查询任务状态")
async def get_task_status(task_id: str):
    """
    查询Celery任务状态
    """
    from sync_crm.tasks.celery_app import app as celery_app

    try:
        task = celery_app.AsyncResult(task_id)
        return {
            "task_id": task_id,
            "status": task.state,
            "result": task.result if task.ready() else None,
            "traceback": task.traceback if task.failed() else None,
        }
    except Exception as e:
        logger.error(f"查询任务状态失败: task_id={task_id}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/logs", summary="查询同步日志列表")
async def get_sync_logs(
    entity_type: Optional[EntityType] = Query(None, description="实体类型"),
    status: Optional[TaskStatus] = Query(None, description="任务状态"),
    operation_type: Optional[OperationType] = Query(None, description="操作类型"),
    limit: int = Query(50, ge=1, le=500, description="返回数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    db: Session = Depends(get_db),
):
    """
    查询同步日志列表
    """
    from sync_crm.models.sync_log import SyncLog

    try:
        query = db.query(SyncLog)

        if entity_type:
            query = query.filter(SyncLog.entity_type == entity_type)
        if status:
            query = query.filter(SyncLog.status == status)
        if operation_type:
            query = query.filter(SyncLog.operation_type == operation_type)

        total = query.count()
        logs = (
            query.order_by(SyncLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "items": [log.to_dict() for log in logs],
        }
    except Exception as e:
        logger.error(f"查询同步日志失败: error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
