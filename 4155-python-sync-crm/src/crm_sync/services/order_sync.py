from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from crm_sync.adapters import CRMAdapter, MarketingAdapter
from crm_sync.config import get_settings
from crm_sync.core import SyncResult
from crm_sync.models import SyncMapping, MappingStatus
from .base_sync import BaseSyncService, SyncDirection


class OrderSyncService(BaseSyncService):
    def __init__(
        self,
        direction: SyncDirection = SyncDirection.CRM_TO_MARKETING,
        db_session: Optional[Session] = None,
    ):
        super().__init__(
            entity_type="order",
            direction=direction,
            db_session=db_session,
        )
        self.settings = get_settings()

    def sync_closed_deals(
        self,
        days: int = 1,
    ) -> SyncResult:
        logger.info(f"Syncing closed deals from last {days} days")

        since = datetime.utcnow() - timedelta(days=days)
        return self.sync_incremental(since=since)

    def mark_as_customer_in_marketing(
        self,
        order_id: str,
    ) -> bool:
        logger.info(f"Marking order {order_id} as customer in marketing")

        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("order")

        order = crm_source.read_by_id(order_id)
        if not order:
            logger.warning(f"Order {order_id} not found in CRM")
            return False

        mapping = (
            self.db.query(SyncMapping)
            .filter(
                SyncMapping.local_id == str(order_id),
                SyncMapping.entity_type == "order",
                SyncMapping.status == MappingStatus.ACTIVE,
            )
            .first()
        )

        if not mapping or not mapping.remote_id:
            logger.warning(f"No mapping found for order {order_id}")
            return False

        marketing_adapter = MarketingAdapter(self.db)
        marketing_target = marketing_adapter.get_target("order", self.db)

        try:
            marketing_target.update(
                mapping.remote_id,
                {
                    "is_customer": True,
                    "customer_status": "converted",
                    "conversion_date": order.get("sign_date", datetime.utcnow().isoformat()),
                },
            )
            return True
        except Exception as e:
            logger.error(f"Failed to mark as customer: {e}")
            return False

    def sync_order_details(
        self,
        order_id: str,
    ) -> Dict[str, Any]:
        logger.info(f"Syncing order details: {order_id}")

        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("order")

        order = crm_source.read_by_id(order_id)
        if not order:
            return {"success": False, "error": "Order not found"}

        result = self.sync_single(order_id)

        if result.success:
            customer_id = order.get("customer_id")
            if customer_id:
                from .customer_sync import CustomerSyncService

                customer_service = CustomerSyncService(
                    direction=self.direction,
                    db_session=self.db,
                )
                customer_service.sync_single(str(customer_id))

        return {
            "success": result.success,
            "order_id": order_id,
            "message": result.message,
        }

    def get_revenue_report(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, Any]:
        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("order")

        orders = crm_source.read_batch(
            batch_size=1000,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
        )

        total_revenue = 0.0
        order_count = 0
        by_industry: Dict[str, float] = {}

        for order in orders:
            amount = float(order.get("amount", 0) or 0)
            total_revenue += amount
            order_count += 1

            industry = order.get("industry", "unknown")
            by_industry[industry] = by_industry.get(industry, 0) + amount

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_revenue": total_revenue,
            "order_count": order_count,
            "avg_order_value": total_revenue / order_count if order_count > 0 else 0,
            "by_industry": by_industry,
        }

    def trigger_marketing_automation(
        self,
        order_id: str,
        event_type: str,
    ) -> bool:
        logger.info(f"Triggering marketing automation for order {order_id}: {event_type}")

        marketing_adapter = MarketingAdapter(self.db)

        try:
            mapping = (
                self.db.query(SyncMapping)
                .filter(
                    SyncMapping.local_id == str(order_id),
                    SyncMapping.entity_type == "order",
                    SyncMapping.status == MappingStatus.ACTIVE,
                )
                .first()
            )

            if not mapping or not mapping.remote_id:
                logger.warning(f"No remote mapping for order {order_id}")
                return False

            marketing_adapter.api.post(
                f"/automation/trigger",
                json_data={
                    "event_type": event_type,
                    "deal_id": mapping.remote_id,
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )
            return True
        except Exception as e:
            logger.error(f"Failed to trigger marketing automation: {e}")
            return False

    def batch_sync_closed_deals(
        self,
        days: int = 7,
    ) -> Dict[str, Any]:
        logger.info(f"Batch syncing closed deals from last {days} days")

        since = datetime.utcnow() - timedelta(days=days)
        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("order")

        closed_orders = list(
            crm_source.read_incremental(
                since=since,
                status="closed",
            )
        )

        synced = 0
        for order in closed_orders:
            order_id = order.get("id")
            if order_id:
                self.mark_as_customer_in_marketing(str(order_id))
                self.trigger_marketing_automation(str(order_id), "deal_won")
                synced += 1

        return {
            "total_closed_deals": len(closed_orders),
            "synced": synced,
            "time_window_days": days,
        }
