"""
同步任务定义
包含客户、联系人、线索、订单的增量/全量同步任务
"""
from typing import Any, Dict, List, Optional
from datetime import datetime

from celery import states
from celery.exceptions import SoftTimeLimitExceeded

from sync_crm.tasks.celery_app import app
from sync_crm.infrastructure.database import get_db_context
from sync_crm.infrastructure.logging import get_logger
from sync_crm.services.customer_sync import CustomerSyncService
from sync_crm.services.contact_sync import ContactSyncService
from sync_crm.services.lead_sync import LeadSyncService
from sync_crm.services.order_sync import OrderSyncService
from sync_crm.models.mapping import EntityType
from sync_crm.models.sync_log import TaskStatus
from sync_crm.utils.sync_source import SyncOrigin

logger = get_logger(__name__)


def _handle_sync_task(
    self,
    sync_service_cls,
    entity_name: str,
    sync_method: str = "sync_incremental",
    sync_source: str = "scheduler",
    **kwargs,
) -> Dict[str, Any]:
    """
    统一处理同步任务的模板方法

    Args:
        self: Celery任务实例
        sync_service_cls: 同步服务类
        entity_name: 实体名称，用于日志
        sync_method: 同步方法名
        sync_source: 触发来源
        **kwargs: 传递给同步方法的参数

    Returns:
        同步结果摘要
    """
    task_id = self.request.id
    logger.info(
        f"开始执行同步任务: entity={entity_name}, method={sync_method}, task_id={task_id}"
    )

    self.update_state(state=states.STARTED, meta={"status": "running"})

    try:
        with get_db_context() as db:
            service = sync_service_cls(db)
            method = getattr(service, sync_method)
            result = method(sync_source=sync_source, **kwargs)

            self.update_state(
                state=states.SUCCESS,
                meta={
                    "status": "completed",
                    "result": result,
                },
            )

            logger.info(
                f"同步任务完成: entity={entity_name}, task_id={task_id}, "
                f"status={result.get('status')}, success={result.get('success_count', 0)}"
            )

            return result

    except SoftTimeLimitExceeded:
        error_msg = f"同步任务超时: entity={entity_name}, task_id={task_id}"
        logger.error(error_msg)
        self.update_state(
            state=states.FAILURE,
            meta={
                "status": "failed",
                "error": "TaskTimeout",
                "error_detail": error_msg,
            },
        )
        raise

    except Exception as e:
        error_msg = f"同步任务异常: entity={entity_name}, task_id={task_id}, error={e}"
        logger.error(error_msg, exc_info=True)
        self.update_state(
            state=states.FAILURE,
            meta={
                "status": "failed",
                "error": type(e).__name__,
                "error_detail": str(e),
            },
        )
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_customers_incremental",
    queue="sync_tasks",
    priority=5,
    time_limit=3600,
    soft_time_limit=3300,
)
def sync_customers_incremental(self, sync_source: str = "scheduler"):
    """客户数据增量同步"""
    return _handle_sync_task(
        self,
        CustomerSyncService,
        "customer",
        "sync_incremental",
        sync_source=sync_source,
    )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_contacts_incremental",
    queue="sync_tasks",
    priority=5,
    time_limit=3600,
    soft_time_limit=3300,
)
def sync_contacts_incremental(self, sync_source: str = "scheduler"):
    """联系人数据增量同步"""
    return _handle_sync_task(
        self,
        ContactSyncService,
        "contact",
        "sync_incremental",
        sync_source=sync_source,
    )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_leads_incremental",
    queue="sync_tasks",
    priority=6,
    time_limit=3600,
    soft_time_limit=3300,
)
def sync_leads_incremental(self, sync_source: str = "scheduler"):
    """线索数据增量同步"""
    return _handle_sync_task(
        self,
        LeadSyncService,
        "lead",
        "sync_incremental",
        sync_source=sync_source,
    )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_orders_incremental",
    queue="sync_tasks",
    priority=4,
    time_limit=3600,
    soft_time_limit=3300,
)
def sync_orders_incremental(self, sync_source: str = "scheduler"):
    """订单数据增量同步"""
    return _handle_sync_task(
        self,
        OrderSyncService,
        "order",
        "sync_incremental",
        sync_source=sync_source,
    )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_customer_full",
    queue="sync_tasks",
    priority=3,
    time_limit=7200,
    soft_time_limit=6900,
)
def sync_customer_full(self, sync_source: str = "manual", operator: Optional[str] = None):
    """客户数据全量同步"""
    return _handle_sync_task(
        self,
        CustomerSyncService,
        "customer",
        "sync_full",
        sync_source=sync_source,
        operator=operator,
    )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_contact_full",
    queue="sync_tasks",
    priority=3,
    time_limit=7200,
    soft_time_limit=6900,
)
def sync_contact_full(self, sync_source: str = "manual", operator: Optional[str] = None):
    """联系人数据全量同步"""
    return _handle_sync_task(
        self,
        ContactSyncService,
        "contact",
        "sync_full",
        sync_source=sync_source,
        operator=operator,
    )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_lead_full",
    queue="sync_tasks",
    priority=3,
    time_limit=7200,
    soft_time_limit=6900,
)
def sync_lead_full(self, sync_source: str = "manual", operator: Optional[str] = None):
    """线索数据全量同步"""
    return _handle_sync_task(
        self,
        LeadSyncService,
        "lead",
        "sync_full",
        sync_source=sync_source,
        operator=operator,
    )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_order_full",
    queue="sync_tasks",
    priority=3,
    time_limit=7200,
    soft_time_limit=6900,
)
def sync_order_full(self, sync_source: str = "manual", operator: Optional[str] = None):
    """订单数据全量同步"""
    return _handle_sync_task(
        self,
        OrderSyncService,
        "order",
        "sync_full",
        sync_source=sync_source,
        operator=operator,
    )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_customer_manual",
    queue="sync_tasks",
    priority=7,
    time_limit=3600,
    soft_time_limit=3300,
)
def sync_customer_manual(
    self,
    record_ids: Optional[List[str]] = None,
    operator: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
):
    """客户手工同步"""
    with get_db_context() as db:
        service = CustomerSyncService(db)
        start_dt = datetime.fromisoformat(start_time) if start_time else None
        end_dt = datetime.fromisoformat(end_time) if end_time else None
        return service.sync_manual(
            record_ids=record_ids,
            operator=operator,
            start_time=start_dt,
            end_time=end_dt,
        )


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_customer_event",
    queue="sync_tasks",
    priority=8,
    time_limit=600,
    soft_time_limit=540,
)
def sync_customer_event(
    self,
    customer_id: str,
    operation: str,
    origin: str = SyncOrigin.CRM.value,
):
    """
    客户变更事件触发的同步（CDC/事件监听）

    Args:
        customer_id: CRM客户ID
        operation: 操作类型: created/updated/deleted
        origin: 数据来源系统
    """
    task_id = self.request.id
    logger.info(
        f"收到客户变更事件: customer_id={customer_id}, operation={operation}, task_id={task_id}"
    )

    try:
        with get_db_context() as db:
            service = CustomerSyncService(db)

            if operation == "created":
                result = service.sync_customer_created(customer_id)
            elif operation == "updated":
                result = service.sync_customer_updated(customer_id)
            elif operation == "deleted":
                result = service.sync_customer_deleted(customer_id)
            else:
                raise ValueError(f"未知操作类型: {operation}")

            logger.info(
                f"客户事件同步完成: customer_id={customer_id}, operation={operation}, task_id={task_id}"
            )

            return result

    except Exception as e:
        logger.error(
            f"客户事件同步失败: customer_id={customer_id}, operation={operation}, error={e}",
            exc_info=True,
        )
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_contact_event",
    queue="sync_tasks",
    priority=8,
    time_limit=600,
    soft_time_limit=540,
)
def sync_contact_event(
    self,
    contact_id: str,
    operation: str,
    customer_id: Optional[str] = None,
    origin: str = SyncOrigin.CRM.value,
):
    """
    联系人变更事件触发的同步

    Args:
        contact_id: CRM联系人ID
        operation: 操作类型: created/updated/deleted
        customer_id: 关联的客户ID
        origin: 数据来源系统
    """
    task_id = self.request.id
    logger.info(
        f"收到联系人变更事件: contact_id={contact_id}, operation={operation}, "
        f"customer_id={customer_id}, task_id={task_id}"
    )

    try:
        with get_db_context() as db:
            service = ContactSyncService(db)

            if operation == "created":
                result = service.sync_contact_created(contact_id)
            elif operation == "updated":
                result = service.sync_contact_updated(contact_id)
            elif operation == "deleted":
                result = service.sync_contact_deleted(contact_id)
            else:
                raise ValueError(f"未知操作类型: {operation}")

            logger.info(
                f"联系人事件同步完成: contact_id={contact_id}, operation={operation}, task_id={task_id}"
            )

            return result

    except Exception as e:
        logger.error(
            f"联系人事件同步失败: contact_id={contact_id}, operation={operation}, error={e}",
            exc_info=True,
        )
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_lead_event",
    queue="sync_tasks",
    priority=8,
    time_limit=600,
    soft_time_limit=540,
)
def sync_lead_event(
    self,
    lead_id: str,
    operation: str,
    origin: str = SyncOrigin.MARKETING.value,
):
    """
    线索变更事件触发的同步（从营销平台到CRM）

    Args:
        lead_id: 营销平台线索ID
        operation: 操作类型: created/updated
        origin: 数据来源系统
    """
    task_id = self.request.id
    logger.info(
        f"收到线索变更事件: lead_id={lead_id}, operation={operation}, task_id={task_id}"
    )

    try:
        with get_db_context() as db:
            service = LeadSyncService(db)

            if operation == "created":
                result = service.sync_lead_created(lead_id)
            elif operation == "updated":
                result = service.sync_lead_updated(lead_id)
            else:
                raise ValueError(f"未知操作类型: {operation}")

            logger.info(
                f"线索事件同步完成: lead_id={lead_id}, operation={operation}, task_id={task_id}"
            )

            return result

    except Exception as e:
        logger.error(
            f"线索事件同步失败: lead_id={lead_id}, operation={operation}, error={e}",
            exc_info=True,
        )
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.sync_order_event",
    queue="sync_tasks",
    priority=8,
    time_limit=600,
    soft_time_limit=540,
)
def sync_order_event(
    self,
    order_id: str,
    operation: str,
    origin: str = SyncOrigin.CRM.value,
):
    """
    订单变更事件触发的同步

    Args:
        order_id: 订单ID
        operation: 操作类型: created/confirmed/paid
        origin: 数据来源系统
    """
    task_id = self.request.id
    logger.info(
        f"收到订单变更事件: order_id={order_id}, operation={operation}, task_id={task_id}"
    )

    try:
        with get_db_context() as db:
            service = OrderSyncService(db)

            if operation == "created":
                result = service.sync_order_created(order_id)
            elif operation == "confirmed":
                result = service.sync_order_confirmed(order_id)
            elif operation == "paid":
                result = service.sync_order_paid(order_id)
            else:
                raise ValueError(f"未知操作类型: {operation}")

            logger.info(
                f"订单事件同步完成: order_id={order_id}, operation={operation}, task_id={task_id}"
            )

            return result

    except Exception as e:
        logger.error(
            f"订单事件同步失败: order_id={order_id}, operation={operation}, error={e}",
            exc_info=True,
        )
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.batch_sync_by_region",
    queue="sync_tasks",
    priority=2,
    time_limit=10800,
    soft_time_limit=10500,
)
def batch_sync_by_region(self, region: str, operator: Optional[str] = None):
    """按区域批量同步客户"""
    task_id = self.request.id
    logger.info(
        f"开始按区域批量同步: region={region}, operator={operator}, task_id={task_id}"
    )

    try:
        with get_db_context() as db:
            service = CustomerSyncService(db)
            result = service.batch_sync_by_region(region, operator=operator)

            logger.info(
                f"按区域批量同步完成: region={region}, task_id={task_id}, "
                f"processed={result.get('processed', 0)}"
            )

            return result

    except Exception as e:
        logger.error(
            f"按区域批量同步失败: region={region}, error={e}",
            exc_info=True,
        )
        raise


@app.task(
    bind=True,
    name="sync_crm.tasks.batch_sync_by_industry",
    queue="sync_tasks",
    priority=2,
    time_limit=10800,
    soft_time_limit=10500,
)
def batch_sync_by_industry(self, industry: str, operator: Optional[str] = None):
    """按行业批量同步客户"""
    task_id = self.request.id
    logger.info(
        f"开始按行业批量同步: industry={industry}, operator={operator}, task_id={task_id}"
    )

    try:
        with get_db_context() as db:
            service = CustomerSyncService(db)
            result = service.batch_sync_by_industry(industry, operator=operator)

            logger.info(
                f"按行业批量同步完成: industry={industry}, task_id={task_id}, "
                f"processed={result.get('processed', 0)}"
            )

            return result

    except Exception as e:
        logger.error(
            f"按行业批量同步失败: industry={industry}, error={e}",
            exc_info=True,
        )
        raise
