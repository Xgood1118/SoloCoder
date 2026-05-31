"""
订单数据同步服务
"""
from datetime import datetime
from typing import Dict, Any, Optional, List

from sqlalchemy.orm import Session

from sync_crm.config import settings
from sync_crm.models.mapping import EntityType, SyncMapping, MappingStatus
from sync_crm.models.entities import Order, OrderStatus
from sync_crm.services.base import SyncService, SyncDirection
from sync_crm.services.customer_sync import CustomerSyncService
from sync_crm.infrastructure.logging import get_logger
from sync_crm.utils.sync_source import SyncOrigin, check_sync_loop, mark_sync_source

logger = get_logger(__name__)


class OrderSyncService(SyncService):
    """
    订单数据同步服务

    双向同步：
    - CRM -> 营销平台：订单签约后标记客户为成交用户
    - 营销平台 -> CRM：营销活动产生的订单同步到CRM

    关键：防循环同步机制
    """

    entity_type = EntityType.ORDER
    direction = SyncDirection.BIDIRECTIONAL

    def __init__(self, db_session: Session):
        super().__init__(db_session)
        self.customer_service = CustomerSyncService(db_session)

    def _check_and_prevent_loop(
        self,
        order_data: Dict[str, Any],
        target_direction: SyncDirection,
    ) -> bool:
        """
        检查并防止循环同步

        Returns:
            True表示需要跳过（存在循环风险），False表示可以同步
        """
        target_origin = (
            SyncOrigin.CRM
            if target_direction == SyncDirection.MARKETING_TO_CRM
            else SyncOrigin.MARKETING
        )

        if check_sync_loop(order_data, target_origin):
            logger.debug(
                f"检测到循环同步，跳过: order_id={order_data.get('id')}, "
                f"direction={target_direction.value}"
            )
            return True

        return False

    def sync_order_created(
        self,
        order_id: str,
        order_data: Dict[str, Any],
        source: SyncOrigin = SyncOrigin.CRM,
    ) -> Dict[str, Any]:
        """
        订单创建事件同步

        标记sync_source，防止循环同步。
        """
        logger.info(f"订单创建事件同步: order_id={order_id}, source={source.value}")

        order_data["id"] = order_id
        order_data = mark_sync_source(order_data, source)

        direction = (
            SyncDirection.CRM_TO_MARKETING
            if source == SyncOrigin.CRM
            else SyncDirection.MARKETING_TO_CRM
        )

        if self._check_and_prevent_loop(order_data, direction):
            return {
                "status": "skipped",
                "reason": "sync_loop_prevented",
                "order_id": order_id,
            }

        if source == SyncOrigin.CRM and order_data.get("status") == OrderStatus.CONFIRMED.value:
            self._handle_order_confirm(order_data)

        result = self.sync_manual(
            record_ids=[order_id],
            direction=direction,
            operator="event_listener",
        )

        return result

    def sync_order_updated(
        self,
        order_id: str,
        order_data: Dict[str, Any],
        source: SyncOrigin = SyncOrigin.CRM,
    ) -> Dict[str, Any]:
        """
        订单更新事件同步

        特殊处理：
        - 订单状态变更为已确认时，标记客户为成交用户
        """
        logger.info(f"订单更新事件同步: order_id={order_id}, source={source.value}")

        order_data["id"] = order_id
        order_data = mark_sync_source(order_data, source)

        direction = (
            SyncDirection.CRM_TO_MARKETING
            if source == SyncOrigin.CRM
            else SyncDirection.MARKETING_TO_CRM
        )

        if self._check_and_prevent_loop(order_data, direction):
            return {
                "status": "skipped",
                "reason": "sync_loop_prevented",
                "order_id": order_id,
            }

        old_status = order_data.get("_old_status")
        new_status = order_data.get("status")

        if (
            old_status != OrderStatus.CONFIRMED.value
            and new_status == OrderStatus.CONFIRMED.value
        ):
            self._handle_order_confirm(order_data)

        if new_status == OrderStatus.PAID.value:
            self._handle_order_paid(order_data)

        result = self.sync_manual(
            record_ids=[order_id],
            direction=direction,
            operator="event_listener",
        )

        return result

    def _handle_order_confirm(self, order_data: Dict[str, Any]) -> None:
        """
        处理订单确认

        在营销平台标记客户为成交用户，触发营销动作。
        """
        customer_id = order_data.get("customer_id")
        if not customer_id:
            logger.warning(f"订单缺少客户ID，跳过成交标记: order_id={order_data.get('id')}")
            return

        try:
            self.customer_service.mark_as_customer_converted(
                customer_id,
                {
                    "order_id": order_data.get("id"),
                    "order_no": order_data.get("order_no"),
                    "order_amount": order_data.get("order_amount"),
                    "sign_date": order_data.get("sign_date"),
                    "contract_start_date": order_data.get("contract_start_date"),
                    "contract_end_date": order_data.get("contract_end_date"),
                    "contract_term_months": order_data.get("contract_term_months"),
                    "product_name": order_data.get("product_name"),
                    "is_first_order": order_data.get("is_first_order", False),
                },
            )
        except Exception as e:
            logger.error(
                f"标记客户成交失败: customer_id={customer_id}, error={e}",
                exc_info=True,
            )

    def _handle_order_paid(self, order_data: Dict[str, Any]) -> None:
        """
        处理订单付款

        可以触发额外的营销动作，如发送感谢邮件等。
        """
        logger.info(
            f"订单已付款，触发后续营销动作: order_id={order_data.get('id')}, "
            f"amount={order_data.get('paid_amount')}"
        )

    def sync_crm_to_marketing(
        self,
        is_full: bool = False,
        operator: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        CRM到营销平台的订单同步

        同步签约金额、签约日期、合同期限等信息，
        方便营销平台做客户画像和复购预测。
        """
        logger.info(f"订单同步: CRM -> 营销平台, full={is_full}")

        if is_full:
            return self.sync_full(
                direction=SyncDirection.CRM_TO_MARKETING,
                operator=operator,
            )
        else:
            return self.sync_incremental(
                direction=SyncDirection.CRM_TO_MARKETING,
            )

    def sync_marketing_to_crm(
        self,
        is_full: bool = False,
        operator: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        营销平台到CRM的订单同步

        同步营销活动产生的订单到CRM。
        """
        logger.info(f"订单同步: 营销平台 -> CRM, full={is_full}")

        if is_full:
            return self.sync_full(
                direction=SyncDirection.MARKETING_TO_CRM,
                operator=operator,
            )
        else:
            return self.sync_incremental(
                direction=SyncDirection.MARKETING_TO_CRM,
            )

    def get_order_mapping(self, order_id: str) -> Optional[Dict[str, Any]]:
        """获取订单映射关系"""
        mapping = SyncMapping.find_by_local(
            self.db_session, order_id, EntityType.ORDER
        )

        if mapping:
            return {
                "local_id": mapping.local_id,
                "remote_id": mapping.remote_id,
                "entity_type": mapping.entity_type.value,
                "last_sync_time": mapping.last_sync_time,
                "sync_version": mapping.sync_version,
                "status": mapping.status.value,
                "sync_source": mapping.sync_source,
            }
        return None

    def get_customer_orders(
        self,
        customer_id: str,
        status: Optional[OrderStatus] = None,
    ) -> List[Dict[str, Any]]:
        """获取客户的订单列表"""
        from sync_crm.models.mapping import SyncMapping

        mappings = (
            self.db_session.query(SyncMapping)
            .filter(
                SyncMapping.entity_type == EntityType.ORDER,
                SyncMapping.status == MappingStatus.ACTIVE,
            )
            .all()
        )

        result = []
        for m in mappings:
            order_info = {
                "local_id": m.local_id,
                "remote_id": m.remote_id,
                "last_sync_time": m.last_sync_time,
                "sync_source": m.sync_source,
            }
            result.append(order_info)

        if status:
            result = [o for o in result if o.get("status") == status.value]

        return result

    def get_customer_lifetime_value(self, customer_id: str) -> Dict[str, Any]:
        """
        计算客户生命周期价值

        汇总客户所有订单金额，用于客户画像。
        """
        orders = self.get_customer_orders(customer_id)

        total_amount = 0.0
        order_count = 0
        first_order_date = None
        last_order_date = None

        for order in orders:
            amount = order.get("order_amount", 0)
            total_amount += amount
            order_count += 1

            order_date = order.get("sign_date")
            if order_date:
                if first_order_date is None or order_date < first_order_date:
                    first_order_date = order_date
                if last_order_date is None or order_date > last_order_date:
                    last_order_date = order_date

        return {
            "customer_id": customer_id,
            "total_order_count": order_count,
            "total_amount": total_amount,
            "average_order_value": total_amount / order_count if order_count > 0 else 0,
            "first_order_date": first_order_date,
            "last_order_date": last_order_date,
            "currency": "CNY",
        }

    def batch_sync_orders_by_date(
        self,
        start_date: datetime,
        end_date: datetime,
        direction: SyncDirection = SyncDirection.CRM_TO_MARKETING,
    ) -> Dict[str, Any]:
        """
        按日期范围批量同步订单

        用于修复历史数据。
        """
        logger.info(
            f"按日期范围批量同步订单: {start_date} ~ {end_date}, "
            f"direction={direction.value}"
        )

        result = self.sync_manual(
            direction=direction,
            operator="manual_date_range_sync",
            start_time=start_date,
            end_time=end_date,
        )

        return result
